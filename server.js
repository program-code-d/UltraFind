const express = require('express');
const app = express();
const path = require('path');
const { measureMemory } = require('vm');

app.use(express.json());
app.use(express.static(__dirname, { index: false }));

let messageArray=[];
app.get('/', (req, res) =>
{
    console.log('Here')
    res.sendFile(path.join(__dirname, 'login.html'));
})

app.post('/sendmessage', (req,res)=>
{
   console.log(req.body);
   messageArray=req.body.messages;
   res.send('Message received');
})
app.get('/getupdate', (req,res)=>
{
    res.json(messageArray);
})
app.post('/password', (req,res)=>
{
    let password=req.body.password;
    console.log(password)
    if(password==1234)
    {         
//res.sendFile(path.join(__dirname, 'index.html'));
          res.json({ok:1});
    }
    else
    {
 res.json({ok:0});
    }
})
app.listen(8080)