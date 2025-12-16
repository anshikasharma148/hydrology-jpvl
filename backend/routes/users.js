const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { usersDB, hydrologyDB } = require("../db");

const router = express.Router();

// Helper function to get client IP address
const getClientIP = async (req) => {
  // First, try to get IP from headers (works when behind proxy/load balancer)
  // x-forwarded-for contains the original client IP when behind proxy
  let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           null;

  // Clean up IP (remove IPv6 prefix if present)
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  // If IP is localhost/private IP and we're testing locally, 
  // the request is coming from the same machine, so we can't get the actual user's IP
  // In production, x-forwarded-for should contain the real client IP
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    // Check if we have x-forwarded-for with a real IP (shouldn't happen for localhost, but check anyway)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(i => i.trim());
      const realIP = ips.find(i => i && i !== '127.0.0.1' && !i.startsWith('192.168.') && !i.startsWith('10.') && !i.startsWith('172.'));
      if (realIP) {
        console.log(`[IP Detection] Found real client IP in x-forwarded-for: ${realIP}`);
        return realIP;
      }
    }
    
    // If still localhost/private, and we're testing locally, try to get server's public IP
    // This is a fallback - in production, x-forwarded-for should always have the real client IP
    console.warn('[IP Detection] Localhost/private IP detected. Attempting to get public IP as fallback.');
    try {
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
              console.log(`[IP Detection] Using server's public IP as fallback: ${json.ip}`);
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
      console.warn('[IP Detection] Failed to get public IP:', error.message);
      return ip || 'Unknown';
    }
  }

  console.log(`[IP Detection] Using client IP: ${ip}`);
  return ip;
};

// Helper function to get location and ISP info from IP address
const getIPLocation = async (ipAddress) => {
  // Skip if IP is unknown or localhost
  if (!ipAddress || ipAddress === 'Unknown' || ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
    return { location: null, ispName: null };
  }

  try {
    const http = require('http');
    console.log(`[IP Location] Fetching location data for IP: ${ipAddress}`);
    const locationData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`[IP Location] Request timeout for IP: ${ipAddress}`);
        reject(new Error('Timeout'));
      }, 4000);
      // Using ip-api.com free service (HTTP only for free tier, no API key required)
      // Requesting additional fields: as (AS number and name), query (IP), timezone, district, zip
      const url = `http://ip-api.com/json/${ipAddress}?fields=status,message,country,regionName,city,district,zip,timezone,isp,org,as,asname,query`;
      console.log(`[IP Location] Requesting: ${url}`);
      http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            const json = JSON.parse(data);
            console.log(`[IP Location] Response for ${ipAddress}:`, JSON.stringify(json));
            if (json.status === 'success') {
              // Format: City, District (if available), Region, Country
              const locationParts = [];
              if (json.city) locationParts.push(json.city);
              if (json.district) locationParts.push(json.district);
              if (json.regionName) locationParts.push(json.regionName);
              if (json.country) locationParts.push(json.country);
              // Add zip code if available
              if (json.zip) {
                locationParts[locationParts.length - 1] = `${locationParts[locationParts.length - 1]} ${json.zip}`;
              }
              const location = locationParts.length > 0 ? locationParts.join(', ') : null;
              
              // Build ISP/Router name with more details
              // Combine ISP, Organization, and AS name for more complete information
              const ispParts = [];
              if (json.isp) ispParts.push(json.isp);
              if (json.org && json.org !== json.isp) {
                // Only add org if it's different from ISP
                ispParts.push(`(${json.org})`);
              }
              if (json.asname && !json.isp.includes(json.asname) && !json.org?.includes(json.asname)) {
                // Add AS name if it provides additional info
                ispParts.push(`[${json.asname}]`);
              }
              const ispName = ispParts.length > 0 ? ispParts.join(' ') : null;
              
              console.log(`[IP Location] Parsed - Location: ${location}, ISP/Router: ${ispName}`);
              resolve({ location, ispName });
            } else {
              console.warn(`[IP Location] API returned status: ${json.status}, message: ${json.message || 'N/A'}`);
              resolve({ location: null, ispName: null });
            }
          } catch (e) {
            console.error(`[IP Location] JSON parse error:`, e.message);
            reject(e);
          }
        });
      }).on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[IP Location] HTTP request error:`, err.message);
        reject(err);
      });
    });
    return locationData;
  } catch (error) {
    console.error('[IP Location] Failed to get location for IP:', ipAddress, error.message);
    return { location: null, ispName: null };
  }
};

// Helper function to log login attempt
const logLoginAttempt = async (userId, email, name, role, ipAddress, loginType, status, userLocationFromBrowser = null) => {
  try {
    console.log(`[LOGIN LOG] Attempting to log: ${email}, ${name}, ${role}, ${ipAddress}, ${loginType}, ${status}`);
    
    // Priority 1: Use browser geolocation if provided (most accurate - user's actual location)
    let location = null;
    let ispName = null;
    
    if (userLocationFromBrowser && userLocationFromBrowser.address) {
      // Use browser-provided location (most accurate - user's actual location)
      location = userLocationFromBrowser.address;
      console.log(`[LOGIN LOG] Using browser geolocation: ${location}`);
      
      // Still get ISP info from IP address
      try {
        const locationInfo = await Promise.race([
          getIPLocation(ipAddress),
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ location: null, ispName: null });
            }, 3000);
          })
        ]);
        ispName = locationInfo.ispName;
        if (ispName) {
          console.log(`[LOGIN LOG] ISP from IP: ${ispName}`);
        }
      } catch (error) {
        console.warn('[LOGIN LOG] Failed to get ISP info:', error.message);
      }
    } else {
      // Priority 2: Fall back to IP-based location (less accurate)
      try {
        console.log(`[LOGIN LOG] Browser location not available, fetching location for IP: ${ipAddress}`);
        const locationInfo = await Promise.race([
          getIPLocation(ipAddress),
          new Promise((resolve) => {
            setTimeout(() => {
              console.warn('[LOGIN LOG] Location fetch timed out after 5 seconds');
              resolve({ location: null, ispName: null });
            }, 5000);
          })
        ]);
        location = locationInfo.location;
        ispName = locationInfo.ispName;
        if (location || ispName) {
          console.log(`[LOGIN LOG] Location from IP: ${location}, ISP: ${ispName}`);
        } else {
          console.warn(`[LOGIN LOG] No location/ISP data received for IP: ${ipAddress}`);
        }
      } catch (error) {
        console.error('[LOGIN LOG] Failed to get location info:', error.message);
        console.error('[LOGIN LOG] Error details:', error);
      }
    }
    
    const result = await hydrologyDB.query(
      `INSERT INTO login_logs (user_id, email, name, role, ip_address, login_type, login_status, location, isp_name, login_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, email, name, role, ipAddress, loginType, status, location, ispName]
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
    const { email, password, role, userLocation } = req.body;
    const ipAddress = await getClientIP(req);
    console.log(`[LOGIN] Email: ${email}, IP: ${ipAddress}, Requested Role: ${role}`);
    if (userLocation) {
      console.log(`[LOGIN] Browser location provided: ${userLocation.address || 'N/A'}`);
    }

    const [user] = await usersDB.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (user.length === 0) {
      // Log failed login attempt
      await logLoginAttempt(null, email, 'Unknown', 'Unknown', ipAddress, 'user', 'failed', userLocation);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const dbUser = user[0];
    
    // Security: Validate that the selected role exactly matches the user's actual role in database
    const selectedRole = role ? role.trim() : '';
    const actualRole = dbUser.role ? dbUser.role.trim() : '';
    
    // Normalize roles for comparison (case-insensitive)
    const selectedRoleLower = selectedRole.toLowerCase();
    const actualRoleLower = actualRole.toLowerCase();
    
    // Strict role validation: selected role must match actual role
    if (selectedRoleLower !== actualRoleLower) {
      const fullName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || 'Unknown';
      console.log(`[LOGIN] Role mismatch. Selected: "${selectedRole}", Actual: "${actualRole}"`);
      await logLoginAttempt(dbUser.id, email, fullName, dbUser.role, ipAddress, 'user', 'failed', userLocation);
      return res.status(403).json({ error: `Access denied. Your role is "${actualRole}", but you selected "${selectedRole}". Please select the correct role.` });
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
      await logLoginAttempt(dbUser.id, email, fullName, dbUser.role, ipAddress, 'user', 'failed', userLocation);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Log successful login
    const fullName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || 'Unknown';
    // If user selected admin role and is admin, log as admin login, otherwise user login
    const loginType = (role && role.toLowerCase() === 'admin' && dbUser.role && dbUser.role.toLowerCase() === 'admin') ? 'admin' : 'user';
    await logLoginAttempt(dbUser.id, email, fullName, dbUser.role, ipAddress, loginType, 'success', userLocation);

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
    const { email, password, userLocation } = req.body;
    const ipAddress = await getClientIP(req);
    console.log(`[ADMIN LOGIN] Email: ${email}, IP: ${ipAddress}`);
    if (userLocation) {
      console.log(`[ADMIN LOGIN] Browser location provided: ${userLocation.address || 'N/A'}`);
    }

    // First check if user exists
    const [userRows] = await usersDB.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (userRows.length === 0) {
      // Log failed admin login attempt
      await logLoginAttempt(null, email, 'Unknown', 'admin', ipAddress, 'admin', 'failed', userLocation);
      return res.status(403).json({ message: "Access denied. Invalid credentials" });
    }

    const user = userRows[0];
    
    // Debug: Log the actual role value
    console.log(`[ADMIN LOGIN] User found. Role in DB: "${user.role}" (type: ${typeof user.role})`);
    
    // Security: Only allow users with admin role to use admin login
    // Trim and normalize the role for comparison
    const userRole = user.role ? user.role.toString().trim().toLowerCase() : '';
    if (!userRole || userRole !== 'admin') {
      // Log failed admin login attempt (non-admin trying to access admin login)
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
      console.log(`[ADMIN LOGIN] Access denied. User role: "${user.role}", Normalized: "${userRole}"`);
      await logLoginAttempt(user.id, email, fullName, user.role, ipAddress, 'admin', 'failed', userLocation);
      return res.status(403).json({ message: "Access denied. Not an admin" });
    }
    
    console.log(`[ADMIN LOGIN] Role validation passed. Proceeding with password check.`);

    const admin = user;

    let isMatch = false;
    if (admin.new_password) {
      isMatch = await bcrypt.compare(password, admin.new_password);
      console.log(`[ADMIN LOGIN] Password check (new_password): ${isMatch}`);
    } else {
      // For default password, compare directly (not hashed)
      isMatch = password === admin.default_password;
      console.log(`[ADMIN LOGIN] Password check (default_password): ${isMatch}, Provided: "${password}", Expected: "${admin.default_password}"`);
    }

    if (!isMatch) {
      // Log failed admin login attempt
      const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Unknown';
      console.log(`[ADMIN LOGIN] Password mismatch. Login failed.`);
      await logLoginAttempt(admin.id, email, fullName, admin.role, ipAddress, 'admin', 'failed', userLocation);
      return res.status(400).json({ message: "Invalid credentials" });
    }
    
    console.log(`[ADMIN LOGIN] Password validated. Login successful.`);

    // Log successful admin login
    const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Unknown';
    await logLoginAttempt(admin.id, email, fullName, admin.role, ipAddress, 'admin', 'success', userLocation);

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

