const express = require('express');
const crypto = require("crypto");
const mariadb = require('mariadb'); // 1. Import MariaDB
const app = express();
const PORT = 8080;
const path = require('path');

// 2. Create a Connection Pool
// Replace these with your actual MariaDB credentials
const pool = mariadb.createPool({
     host: 'localhost', 
     user: 'root', 
     password: 'chicken55441',
     database: 'test',
     connectionLimit: 5
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname, { index: false }));
function hashPassword(passw_string) {
    return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

let emailExist=0
async function registerUser(user) {
    let conn;
    try {
        if (!user.email) throw new Error("Email is required");
        const hashedPassword = hashPassword(user.password);
        conn = await pool.getConnection();
        
        const firstName = user.firstName || user.first_name;
        const lastName = user.lastName || user.last_name;

        // Using ? as placeholders to prevent SQL Injection
        const query = "INSERT INTO Users (first_name,last_name,email,password,age,location) VALUES (?, ?, ?, ?, ?, ?)";
        const res = await conn.query(query, [firstName,lastName,user.email,hashedPassword,user.age,""]);
        
        console.log("User registered! Insert ID:", res.insertId);
    } catch (err) {
        console.error(err)
        if(err.errno==1062)
        {
            emailExist=1
        }
    } finally {
        if (conn) conn.release(); // Release connection back to pool
    }
}
app.get('/', (req, res) =>
{
    res.sendFile(path.join(__dirname, 'intro.html'));
})

app.post('/signup', async (req, res) => {
    console.log("Signup request:", req.body);
    try {
        await registerUser(req.body);
          res.json({message:"Email In Use"})
        res.send("User registered in MariaDB!");
    } catch (err) {
          
        res.status(400).send(err.message);
    }
  
});

app.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`);
});