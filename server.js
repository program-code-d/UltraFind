const express = require('express');
const app = express();
const path = require('path');
const { measureMemory } = require('vm');
const fs = require("fs");
const crypto = require("crypto");
app.use(express.json());
app.use(express.static(__dirname, { index: false }));

function hashPassword(passw_string)
{
  return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

app.get('/', (req, res) =>
{
    console.log('Here')
    res.sendFile(path.join(__dirname, 'login.html'));
})

app.post('/signup', (req,res)=>
{
    
})
app.listen(8080)