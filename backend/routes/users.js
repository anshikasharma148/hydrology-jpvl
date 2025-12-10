const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { usersDB } = require("../db");

const router = express.Router();

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
    const { email, password } = req.body;

    const [user] = await usersDB.query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0) return res.status(400).json({ error: "Invalid credentials" });

    const dbUser = user[0];
    let validPass = false;

    if (dbUser.new_password) {
      validPass = await bcrypt.compare(password, dbUser.new_password);
    } else {
      validPass = password === dbUser.default_password;
    }

    if (!validPass) return res.status(400).json({ error: "Invalid credentials" });

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
    const { email, password } = req.body;

    const [rows] = await usersDB.query(
      "SELECT * FROM users WHERE email = ? AND LOWER(role) = 'admin'",
      [email]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: "Access denied. Not an admin" });
    }

    const admin = rows[0];

    let isMatch = false;
    if (admin.new_password) {
      isMatch = await bcrypt.compare(password, admin.new_password);
    } else {
      isMatch = password === admin.default_password;
    }

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

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
        name: `${admin.first_name} ${admin.last_name}`,
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

module.exports = router;

