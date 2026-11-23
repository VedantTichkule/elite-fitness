require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const cors = require("cors");
const session = require("express-session");

const app = express();

// **🔹 CORS Fix**
app.use(cors({
    origin: ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:5001"], // Allow frontend origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow all necessary methods
    credentials: true // Allow cookies (for session handling)
}));

app.use(express.json()); // Parse JSON request body

// **🔹 Session Configuration**
app.use(session({
    secret: process.env.SESSION_SECRET || "dev_only_change_me", // Set SESSION_SECRET in .env
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        sameSite: 'lax', // Important for cross-origin in dev
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// **🔹 Database Connection**
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: "user_registration"
});

db.connect((err) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
        process.exit(1);
    } else {
        console.log("✅ Connected to MySQL Database: user_registration");
    }
});

// Create connection to gym_store database
const storeDb = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: "gym_store"
});

storeDb.connect((err) => {
    if (err) {
        console.error("❌ Store Database connection failed:", err);
    } else {
        console.log("✅ Connected to Store Database: gym_store");
    }
});

// **🔹 Registration Endpoint**
app.post("/register", async (req, res) => {
    console.log("📩 Received Registration Data:", req.body); // Debugging

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash password

        // Check if user already exists
        db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
            if (err) {
                console.error("❌ Database Error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            if (results.length > 0) {
                return res.status(409).json({ error: "User already exists" });
            }

            // Insert new user
            const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
            db.query(sql, [username, email, hashedPassword], (err, result) => {
                if (err) {
                    console.error("❌ Database Insertion Error:", err.sqlMessage);
                    return res.status(500).json({ error: "Database insertion failed" });
                }
                console.log("✅ User Registered in Database:", result);
                res.status(201).json({ message: "User registered successfully!" });
            });
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// **🔹 Login Endpoint**
app.post("/login", (req, res) => {
    console.log("📩 Login Attempt for email:", req.body.email);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = results[0];
        console.log("🔹 Found user in DB:", { id: user.id, email: user.email });

        // Compare hashed password
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error("❌ Bcrypt Error:", err);
                return res.status(500).json({ error: "Server error" });
            }
            if (!isMatch) {
                console.log("❌ Incorrect Password Attempt");
                return res.status(401).json({ error: "Invalid email or password" });
            }

            // Set session data
            req.session.user = {
                id: user.id,
                email: user.email,
                username: user.username
            };
            
            console.log("✅ Login Successful. Session set:", req.session.user);
            
            // Save session explicitly
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).json({ error: "Session error" });
                }
                res.json({ 
                    message: "Login successful!", 
                    redirect: "store.html",
                    user: {
                        email: user.email,
                        username: user.username
                    }
                });
            });
        });
    });
});

// **🔹 Check if User is Logged In**
app.get("/check-session", (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// **🔹 Payment Confirmation Endpoint**
app.post("/confirm-payment", (req, res) => {
    // Check if user is logged in
    if (!req.session.user || !req.session.user.email) {
        return res.status(401).json({ success: false, message: "Please login again" });
    }

    const { amount, items } = req.body;
    const userEmail = req.session.user.email;

    // Create the order with the logged-in user's email
    const orderQuery = "INSERT INTO orders (email, address, total_price, created_at) VALUES (?, 'wagholi', ?, NOW())";
    storeDb.query(orderQuery, [userEmail, amount], (err, orderResult) => {
        if (err) {
            console.error("❌ Order creation failed:", err);
            return res.status(500).json({ success: false, message: "Order creation failed" });
        }
        
        const orderId = orderResult.insertId;
        console.log(`✅ Created order #${orderId} for ${userEmail}`);
        
        // Store each item in the order
        const itemValues = items.map(item => [orderId, item.name, item.price]);
        const itemsQuery = "INSERT INTO manual_order_items (transaction_id, item_name, price) VALUES ?";
        
        storeDb.query(itemsQuery, [itemValues], (err) => {
            if (err) {
                console.error("❌ Order items creation failed:", err);
                return res.status(500).json({ success: false, message: "Order items creation failed" });
            }
            
            console.log(`✅ Added ${items.length} items to order #${orderId}`);
            res.json({ 
                success: true, 
                message: "Order confirmed successfully",
                orderDetails: {
                    orderId,
                    email: userEmail,
                    amount,
                    itemCount: items.length
                }
            });
        });
    });
});

// Also let's add a route to check the current logged-in user
app.get("/current-user", (req, res) => {
    if (req.session.user) {
        console.log("Current logged in user:", req.session.user);
        res.json({ 
            loggedIn: true, 
            user: {
                email: req.session.user.email,
                username: req.session.user.username
            }
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// **🔹 Logout Endpoint**
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout session destroy error:", err);
            return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("connect.sid"); // Default session cookie name
        res.json({ message: "Logged out successfully" });
    });
});

// **🚀 Start Server**
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
