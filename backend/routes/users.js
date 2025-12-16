const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { usersDB, hydrologyDB } = require("../db");

const router = express.Router();

// Helper function to get client IP address
const getClientIP = async (req) => {
  // First, try to get IP from headers (works when behind proxy/load balancer)
  let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           null;

  // If IP is localhost/127.0.0.1, try to get public IP from external service
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    try {
      // Try to get public IP from external service
      const https = require('https');
      const publicIP = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
        https.get('https://api.ipify.org?format=json', (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            clearTimeout(timeout);
            try {
              const json = JSON.parse(data);
              resolve(json.ip);
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      return publicIP || ip || 'Unknown';
    } catch (error) {
      // If external service fails, return the original IP or 'Unknown'
      console.warn('[IP Detection] Failed to get public IP:', error.message);
      return ip || 'Unknown';
    }
  }

  return ip;
};

// Helper function to log login attempt
const logLoginAttempt = async (userId, email, name, role, ipAddress, loginType, status) => {
  try {
    console.log(`[LOGIN LOG] Attempting to log: ${email}, ${name}, ${role}, ${ipAddress}, ${loginType}, ${status}`);
    const result = await hydrologyDB.query(
      `INSERT INTO login_logs (user_id, email, name, role, ip_address, login_type, login_status, login_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, email, name, role, ipAddress, loginType, status]
    );
    console.log(`[LOGIN LOG] Successfully logged login attempt. Insert ID: ${result[0]?.insertId || 'N/A'}`);
  } catch (error) {
    console.error("[LOGIN LOG] Error logging login attempt:", error.message);
    console.error("[LOGIN LOG] Full error:", error);
    // Don't throw error - logging failure shouldn't break login
  }
};

// ====================
// 🔐 JWT Middleware
// ====================
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  // ✅ Allow public endpoints (no token needed)
  if (
    req.path === "/login" ||
    req.path === "/register" ||
    req.path === "/update-password" ||
    req.path === "/admin-login"
  ) {
    return next();
  }

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT Error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ====================
// 👑 Admin Check
// ====================
const isAdmin = (req, res, next) => {
  if (req.user.role.toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
};

// ====================
// 📝 Register User
// ====================
router.post("/register", async (req, res) => {
  try {
    const { first_name, middle_name, last_name, email, role } = req.body;

    if (!first_name || !last_name || !email || !role) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    const insertQuery = `
      INSERT INTO users (first_name, middle_name, last_name, email, role)
      VALUES (?, ?, ?, ?, ?)
    `;

    await usersDB.query(insertQuery, [
      first_name,
      middle_name || null,
      last_name,
      email,
      role
    ]);

    return res.status(201).json({ message: "User registered successfully" });

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Email already registered" });
    }
    console.error("DB Insert Error:", err);
    return res.status(500).json({ error: "Database error", details: err.message });
  }
});

// ====================
// 🔑 Login User
// ====================
router.post("/login", async (req, res) => {
  try {
    console.log("[LOGIN] Login attempt received");
    const { email, password, role } = req.body;
    const ipAddress = await getClientIP(req);
    console.log(`[LOGIN] Email: ${email}, IP: ${ipAddress}, Requested Role: ${role}`);

    const [user] = await usersDB.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (user.length === 0) {
      // Log failed login attempt
      await logLoginAttempt(null, email, 'Unknown', 'Unknown', ipAddress, 'user', 'failed');
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const dbUser = user[0];
    
    // Security: Reject if user is trying to log in as admin through regular login route
    // Admins must use /admin-login route
    if (role && role.toLowerCase() === 'admin') {
      const fullName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || 'Unknown';
      await logLoginAttempt(dbUser.id, email, fullName, dbUser.role, ipAddress, 'user', 'failed');
      return res.status(403).json({ error: "Admins must use the admin login page" });
    }
    
    // Security: Reject if user is actually an admin trying to use regular login
    // Admins should use /admin-login route
    if (dbUser.role && dbUser.role.toLowerCase() === 'admin') {
      const fullName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || 'Unknown';
      await logLoginAttempt(dbUser.id, email, fullName, dbUser.role, ipAddress, 'user', 'failed');
      return res.status(403).json({ error: "Admins must use the admin login page" });
    }
    
    let validPass = false;

    if (dbUser.new_password) {
      validPass = await bcrypt.compare(password, dbUser.new_password);
    } else {
      validPass = password === dbUser.default_password;
    }

    if (!validPass) {
      // Log failed login attempt
      const fullName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || 'Unknown';
      await logLoginAttempt(dbUser.id, email, fullName, dbUser.role, ipAddress, 'user', 'failed');
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Log successful login
    const fullName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || 'Unknown';
    await logLoginAttempt(dbUser.id, email, fullName, dbUser.role, ipAddress, 'user', 'success');

    const token = jwt.sign(
      { id: dbUser.id, role: dbUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      role: dbUser.role,
      firstLogin: !dbUser.new_password,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        first_name: dbUser.first_name,
        last_name: dbUser.last_name,
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// Admin Login Route
// =====================
router.post("/admin-login", async (req, res) => {
  try {
    console.log("[ADMIN LOGIN] Admin login attempt received");
    const { email, password } = req.body;
    const ipAddress = await getClientIP(req);
    console.log(`[ADMIN LOGIN] Email: ${email}, IP: ${ipAddress}`);

    // First check if user exists
    const [userRows] = await usersDB.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (userRows.length === 0) {
      // Log failed admin login attempt
      await logLoginAttempt(null, email, 'Unknown', 'admin', ipAddress, 'admin', 'failed');
      return res.status(403).json({ message: "Access denied. Invalid credentials" });
    }

    const user = userRows[0];
    
    // Security: Only allow users with admin role to use admin login
    if (!user.role || user.role.toLowerCase() !== 'admin') {
      // Log failed admin login attempt (non-admin trying to access admin login)
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
      await logLoginAttempt(user.id, email, fullName, user.role, ipAddress, 'admin', 'failed');
      return res.status(403).json({ message: "Access denied. Not an admin" });
    }

    const admin = user;

    let isMatch = false;
    if (admin.new_password) {
      isMatch = await bcrypt.compare(password, admin.new_password);
    } else {
      isMatch = password === admin.default_password;
    }

    if (!isMatch) {
      // Log failed admin login attempt
      const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Unknown';
      await logLoginAttempt(admin.id, email, fullName, admin.role, ipAddress, 'admin', 'failed');
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Log successful admin login
    const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Unknown';
    await logLoginAttempt(admin.id, email, fullName, admin.role, ipAddress, 'admin', 'success');

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Admin login successful",
      token,
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: fullName,
      },
    });

  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ====================
// 🔑 Update Password
// ====================
router.post("/update-password", async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [userRows] = await usersDB.query("SELECT * FROM users WHERE email = ?", [email]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const dbUser = userRows[0];

    if (!dbUser.new_password) {
      if (oldPassword !== dbUser.default_password) {
        return res.status(400).json({ error: "Invalid temporary password" });
      }
    } else {
      const validOld = await bcrypt.compare(oldPassword, dbUser.new_password);
      if (!validOld) {
        return res.status(400).json({ error: "Invalid current password" });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await usersDB.query(
      "UPDATE users SET default_password = ?, new_password = ?, confirm_password = ? WHERE id = ?",
      [hashedPassword, hashedPassword, hashedPassword, dbUser.id]
    );

    await usersDB.query(
      "UPDATE users SET status = 'Active' WHERE id = ? AND (status IS NULL OR status = 'Pending')",
      [dbUser.id]
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ====================
// 👥 Get All Users (protected)
// ====================
router.get("/", authenticate, isAdmin, async (req, res) => {
  try {
    const [users] = await usersDB.query(
      "SELECT id, first_name, last_name, email, role, status FROM users"
    );
    res.json(users);
  } catch (error) {
    console.error("Get Users error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ====================
// ✏️ Update User (Admin only)
// ====================
router.put("/update/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, role, status } = req.body;
    const { id } = req.params;

    await usersDB.query(
      "UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, status = ? WHERE id = ?",
      [first_name, last_name, email, role, status, id]
    );

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update User error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ====================
// ❌ Delete User (Admin only)
// ====================
router.delete("/delete/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await usersDB.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete User error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ====================
// 🙋 Current User (protected)
// ====================
router.get("/me", authenticate, async (req, res) => {
  try {
    const [rows] = await usersDB.query(
      "SELECT id, first_name, middle_name, last_name, email, role, status FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Fetch Profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// 🚀 NEW ADMIN ROUTES
// ===============================
router.get("/admin/users", authenticate, isAdmin, async (req, res) => {
  try {
    const [users] = await usersDB.query(
      "SELECT id, first_name, last_name, email, role, status, default_password, new_password, confirm_password FROM users"
    );
    res.json(users);
  } catch (error) {
    console.error("Admin Get Users error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/users/:id/reset-password", authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const hashedPassword = await bcrypt.hash("cdc@123", 10);

    await usersDB.query(
      "UPDATE users SET default_password = ?, new_password = ?, confirm_password = ?, status = 'Pending' WHERE id = ?",
      [hashedPassword, hashedPassword, hashedPassword, id]
    );

    res.json({ message: "Password reset to default (cdc@123), status set to Pending" });
  } catch (error) {
    console.error("Reset Password error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/users/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, role, status } = req.body;
    const { id } = req.params;

    await usersDB.query(
      "UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, status = ? WHERE id = ?",
      [first_name, last_name, email, role, status, id]
    );

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Admin Update User error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/admin/users/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await usersDB.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Admin Delete User error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ====================
// 📋 Get Login Logs (Admin Only)
// ====================
router.get("/admin/login-logs", authenticate, isAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, loginType, email } = req.query;
    
    let query = "SELECT * FROM login_logs WHERE 1=1";
    const params = [];
    
    if (status) {
      query += " AND login_status = ?";
      params.push(status);
    }
    
    if (loginType) {
      query += " AND login_type = ?";
      params.push(loginType);
    }
    
    if (email) {
      query += " AND email LIKE ?";
      params.push(`%${email}%`);
    }
    
    query += " ORDER BY login_timestamp DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));
    
    const [logs] = await hydrologyDB.query(query, params);
    
    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM login_logs WHERE 1=1";
    const countParams = [];
    
    if (status) {
      countQuery += " AND login_status = ?";
      countParams.push(status);
    }
    
    if (loginType) {
      countQuery += " AND login_type = ?";
      countParams.push(loginType);
    }
    
    if (email) {
      countQuery += " AND email LIKE ?";
      countParams.push(`%${email}%`);
    }
    
    const [countResult] = await hydrologyDB.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    
    res.json({
      success: true,
      data: logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error("Error fetching login logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

