const express = require('express');
const app = express();
const path = require('path');
const { measureMemory } = require('vm');
const fs = require("fs");
const crypto = require("crypto");
const PORT=8080;
app.use(express.json());
app.use(express.static(__dirname, { index: false }));

function registerUser(user)
{
   var hashedPassword=hashPassword(user.password)
   console.log(hashedPassword)
}

function hashPassword(passw_string)
{
  return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

app.get('/', (req, res) =>
{
    res.sendFile(path.join(__dirname, 'intro.html'));
})

app.post('/signup', (req,res)=>
{
    console.log(req.body)
    registerUser(req.body)
})
app.listen(PORT,()=>
{
     console.log(`[server] Running on http://localhost:${PORT}`);
     console.log("[server] Ready to accept requests");
})