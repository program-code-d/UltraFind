const express = require('express');
const crypto = require("crypto");
const mariadb = require('mariadb'); // 1. Import MariaDB
const app = express();
const PORT = 8080;

// 2. Create a Connection Pool
// Replace these with your actual MariaDB credentials
const pool = mariadb.createPool({
     host: 'localhost', 
     user: 'root', 
     password: 'your_password',
     database: 'your_database_name',
     connectionLimit: 5
});

app.use(express.json());

function hashPassword(passw_string) {
    return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

// 3. Updated registerUser to be async
async function registerUser(user) {
    let conn;
    try {
        const hashedPassword = hashPassword(user.password);
        conn = await pool.getConnection();
        
        // Using ? as placeholders to prevent SQL Injection
        const query = "INSERT INTO EMPLOYEE (name, password) VALUES (?, ?)";
        const res = await conn.query(query, [user.username, hashedPassword]);
        
        console.log("User registered! Insert ID:", res.insertId);
    } catch (err) {
        console.error("Database error:", err);
    } finally {
        if (conn) conn.release(); // Release connection back to pool
    }
}

app.post('/signup', async (req, res) => {
    console.log("Signup request:", req.body);
    await registerUser(req.body);
    res.send("User registered in MariaDB!");
});

app.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`);
});