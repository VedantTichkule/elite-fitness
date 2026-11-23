require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection Pool (using promise-based API)
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Vedant1@2@3",
  database: process.env.DB_NAME || "gym_store",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL Database");
    connection.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
}

testConnection();

// Create tables if they don't exist
async function createTables() {
  const productsTable = `
    CREATE TABLE IF NOT EXISTS store_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      image_url VARCHAR(255),
      quantity INT DEFAULT 0,
      category VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const manualOrdersTable = `
    CREATE TABLE IF NOT EXISTS manual_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255),
      address TEXT,
      transaction_id VARCHAR(255),
      total_price DECIMAL(10, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const manualOrderItemsTable = `
    CREATE TABLE IF NOT EXISTS manual_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT,
      product_name VARCHAR(255),
      price DECIMAL(10, 2),
      quantity INT,
      FOREIGN KEY (order_id) REFERENCES manual_orders(id)
    )
  `;

  try {
    await pool.query(productsTable);
    await pool.query(manualOrdersTable);
    await pool.query(manualOrderItemsTable);
    console.log("✅ Tables created successfully");
  } catch (err) {
    console.error("❌ Error creating tables:", err.message);
  }
}

createTables();

// ---------------------- ROUTES ---------------------- //

// Get all products with stock information
app.get("/products", async (req, res) => {
  try {
    console.log("GET /products request received");
    const [results] = await pool.query("SELECT * FROM store_products");
    console.log("Products found:", results.length);
    
    const productsWithStock = results.map(product => ({
      ...product,
      stock: product.quantity,
      stockStatus: product.quantity > 0 ? 'In Stock' : 'Out of Stock'
    }));
    
    console.log("Sending products:", productsWithStock);
    res.json(productsWithStock);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Check stock availability
app.post("/check-stock", (req, res) => {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const checkStockPromises = items.map(item => {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT quantity FROM store_products WHERE name = ?",
        [item.product_name],
        (err, results) => {
          if (err) reject(err);
          else {
            const product = results[0];
            resolve({
              product_name: item.product_name,
              requested: item.quantity,
              available: product ? product.quantity : 0
            });
          }
        }
      );
    });
  });

  Promise.all(checkStockPromises)
    .then(stockResults => {
      const outOfStock = stockResults.filter(item => item.requested > item.available);
      if (outOfStock.length > 0) {
        res.status(400).json({
          error: "Some items are out of stock",
          items: outOfStock
        });
      } else {
        res.json({ success: true });
      }
    })
    .catch(error => {
      res.status(500).json({ error: "Failed to check stock" });
    });
});

// Update manual-checkout to handle stock
app.post("/manual-checkout", async (req, res) => {
  const { email, address, cartItems, transaction_id, total_price } = req.body;

  console.log("Received order:", { email, address, cartItems, transaction_id, total_price });

  if (!email || !address || !cartItems || cartItems.length === 0 || !transaction_id || !total_price) {
    return res.status(400).json({ 
      success: false,
      error: "Missing required data",
      received: { email, address, cartItems, transaction_id, total_price }
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check stock for all items
    for (const item of cartItems) {
      const [rows] = await connection.query(
        "SELECT quantity FROM store_products WHERE name = ?",
        [item.product_name]
      );
      
      if (!rows.length) {
        throw new Error(`Product ${item.product_name} not found!`);
      }
      
      if (rows[0].quantity < item.quantity) {
        throw new Error(`${item.product_name} has insufficient stock! Available: ${rows[0].quantity}`);
      }
    }

    // Insert order
    const [orderResult] = await connection.query(
      "INSERT INTO manual_orders (email, address, transaction_id, total_price) VALUES (?, ?, ?, ?)",
      [email, address, transaction_id, total_price]
    );

    const orderId = orderResult.insertId;

    // Update stock and insert order items
    for (const item of cartItems) {
      await connection.query(
        "UPDATE store_products SET quantity = quantity - ? WHERE name = ?",
        [item.quantity, item.product_name]
      );

      await connection.query(
        "INSERT INTO manual_order_items (order_id, product_name, price, quantity) VALUES (?, ?, ?, ?)",
        [orderId, item.product_name, item.price, item.quantity]
      );
    }

    await connection.commit();
    console.log("Order placed successfully:", orderId);
    res.json({ 
      success: true,
      message: "✅ Order placed successfully", 
      order_id: orderId 
    });

  } catch (error) {
    console.error("Order error:", error.message);
    if (connection) {
      await connection.rollback();
    }
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
