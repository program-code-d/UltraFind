const express = require('express');
const crypto = require("crypto");
const mariadb = require('mariadb'); // 1. Import MariaDB
const app = express();
const PORT = 8080;
const path = require('path');
const { create } = require('domain');

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
function hashPassword(passw_string)
{
    return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

async function registerUser(user)
{
    let conn;
    try
    {
        if (!user.email) throw new Error("Email is required");
        let salt = Math.trunc((Math.random() * (10099999 - 0) + 0) * 78 - 12.2)

        const hashedPassword = hashPassword(user.password + salt);

        conn = await pool.getConnection();

        const firstName = user.firstName || user.first_name;
        const lastName = user.lastName || user.last_name;


        const query = "INSERT INTO Users (first_name,last_name,email,password,age,location,salt) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const res = await conn.query(query, [firstName, lastName, user.email, hashedPassword, user.age, "", salt]);

        console.log("User registered! Insert ID:", res.insertId);
        return { success: true, emailExist: false };
    } catch (err)
    {
        console.error(err)
        if (err.errno == 1062)
        {
            return { emailExist: true };
        }
        throw err;
    } finally
    {
        if (conn) conn.release();
    }
}

function isEmail(email)
{
    // A common regex pattern for basic email validation
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email); // Returns true if valid, false otherwise
}

async function login(user)
{
    let conn;
    try
    {
        if (!user.email) throw new Error("Email is required");
        if (!isEmail(user.email))
        {
            return { success: "false", notEmailFormat: true }
        }


        conn = await pool.getConnection();
        let query = "SELECT salt FROM Users WHERE email = ?;"

        let salt = await conn.query(query, [user.email]);
        const hashedPassword = hashPassword(user.password + salt[0].salt);

        query = "SELECT email, password FROM Users WHERE email = ? AND password = ?;"
        const res = await conn.query(query, [user.email, hashedPassword]);

        console.log("User logged in! Insert ID:", res.insertId);
        return { success: true, userExist: true };
    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
    } finally
    {
        if (conn) conn.release();
    }
}
async function createListing(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();

        // 1. Get the salt (assuming 'query' for salt was defined above)
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);

        // 2. Login and SELECT the 'id' (Crucial step!)
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);

        if (userRows.length > 0)
        {
            // This is the ID from the Users table we need to "import"
            const userId = userRows[0].id;

            // 3. Insert into Listings using that userId
            const insertQuery = "INSERT INTO Listings (user_id, title, description, price) VALUES (?, ?, ?, ?);";
            const res = await conn.query(insertQuery, [
                userId,           // This links the listing to the user
                body.name,
                body.description,
                body.pay
            ]);

            console.log("Listing created! New Listing ID:", res.insertId);
            return { success: true, userExist: true, listingId: res.insertId };
        } else
        {
            return { success: false, message: "Invalid login" };
        }
    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
    } finally
    {
        if (conn) conn.release();
    }
}
async function getListings(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();

        // 1. Get the salt (assuming 'query' for salt was defined above)
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);


        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);

        const senderId = userRows[0].id;

        const insertQuery = "INSERT INTO Friends (sender_id, receiver_id, message_text) VALUES (?, ?, ?)";
        const res = await conn.query(insertQuery, [
            senderId,           // Found from the login check
            body.friend_id,     // From document.getElementById('user-friend-id')
            body.message        // From document.getElementById('user-msg')
        ]);

        return { success: true, insertId: res.insertId, userExist: true };

    } catch (err)
    {
        console.error("Database Error:", err);
        return { success: false, error: "Internal Server Error" };
    } finally
    {
        if (conn) conn.release();
    }
}

async function getListings(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();

        // 1. Get the salt (assuming 'query' for salt was defined above)
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);


        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);


        const insertQuery = "SELECT * FROM Listings WHERE title LIKE ?;";
        const res = await conn.query(insertQuery, [`%${body.search}%`]);

        //   console.log("Listing created! New Listing ID:", res.insertId);
        return { success: true, listings: res, userExist: true };

    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
    } finally
    {
        if (conn) conn.release();
    }
}
async function getNavbar(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();

        // 1. Get the salt (assuming 'query' for salt was defined above)
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);


        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);


     
        navbar=
        `
        <div class = "main-navbar">
            <div id="Home" onclick="goToDifferentScreen('index.html')">
                <div>Home</div>
            </div>
            <div id="Messages" onclick="goToDifferentScreen('messages.html')">
                <div>Messages</div>
            </div>
            <div id="Friends" onclick="goToDifferentScreen('friends.html')">
                <div>Friends</div>
            </div>
            
        </div>
        `
        //   console.log("Listing created! New Listing ID:", res.insertId);
        return { success: true, navbar: navbar, userExist: true };

    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
    } finally
    {
        if (conn) conn.release();
    }
}


async function messageFunc(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();

        // 1. Get the salt (assuming 'query' for salt was defined above)
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);


        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);


        const insertQuery = "SELECT * FROM Listings WHERE title LIKE ?;";
        const res = await conn.query(insertQuery, [`%${body.search}%`]);

        //   console.log("Listing created! New Listing ID:", res.insertId);
        return { success: true, listings: res };

    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
    } finally
    {
        if (conn) conn.release();
    }
}

async function getinfolistings(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();

        // 1. Get the salt (assuming 'query' for salt was defined above)
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);


        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);


        const insertQuery = "SELECT * FROM Listings WHERE title LIKE ?;";
        const res = await conn.query(insertQuery, [`%${body.id}%`]);

        //   console.log("Listing created! New Listing ID:", res.insertId);
        return { success: true, listing: res, userExist: true };

    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
    } finally
    {
        if (conn) conn.release();
    }
}

async function switchFile(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();

        // 1. Get the salt (assuming 'query' for salt was defined above)
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);


        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);



        return { success: true, userExist: true };

    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
    } finally
    {
        if (conn) conn.release();
    }
}


app.get('/', (req, res) =>
{
    res.sendFile(path.join(__dirname, 'intro.html'));
})

app.post('/signup', async (req, res) =>
{
    console.log("Signup request:", req.body);
    try
    {
        const result = await registerUser(req.body);
        if (result && result.emailExist)
        {
            return res.json({ message: "Email In Use" })
        }
        if (result && result.success)
        {
            res.redirect("/index.html")
        }

    } catch (err)
    {

        res.status(400).send(err.message);
    }

});


app.post('/sendmessage', async (req, res) =>
{
    console.log("Signup request:", req.body);
    try
    {
        const result = await messageFunc(req.body);
        if (result && result.emailExist)
        {
            return res.json({ message: "Email In Use" })
        }
        if (result && result.success)
        {
            // res.redirect("/index.html")
        }

    } catch (err)
    {

        res.status(400).send(err.message);
    }

});

app.post('/getInfoListing', async (req, res) =>
{
    console.log("Signup request:", req.body);
    try
    {
        const result = await getinfolistings(req.body);
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            // res.redirect("/index.html")
            res.json(result.listings)
        }

    } catch (err)
    {

        res.status(400).send(err.message);
    }

});

app.post('/login', async (req, res) =>
{
    console.log("login request:", req.body);
    try
    {
        const result = await login(req.body);
        if (result && result.notEmailFormat)
        {
            return res.json({ message: "NotEmailFormat" })
        }
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            res.redirect("/index.html")
        }

    } catch (err)
    {
        res.status(400).send(err.message);
    }

});
app.post('/createListing', async (req, res) =>
{
    console.log("Create Listing request:", req.body);
    try
    {
        const result = await createListing(req.body);
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            res.redirect("/index.html")
        }

    } catch (err)
    {
        res.status(400).send(err.message);
    }

});

app.post('/getListings', async (req, res) =>
{
    try
    {
        const result = await getListings(req.body);
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            // res.redirect("/index.html")
            res.json(result.listings)
        }

    } catch (err)
    {
        res.status(400).send(err.message);
    }

});


app.post('/getNavbar', async (req, res) =>
{

    try
    {
        const result = await getNavbar(req.body);
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            res.json(result.navbar)
        }

    } catch (err)
    {
        res.status(400).send(err.message);
    }

});


app.post('/switchFile', async (req, res) =>
{
    // console.log("Create Listing request:", req.body);
    try
    {
        const result = await switchFile(req.body);
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            res.redirect("/" + req.body.file)
            //res.json(result.listings)
        }

    } catch (err)
    {
        res.status(400).send(err.message);
    }

});
app.post('/sendfriendmessage', async (req, res) =>
{
    try
    {
        const result = await sendfriendmessage(req.body);
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            // res.redirect("/index.html")
            res.json(result.listings)
        }

    } catch (err)
    {
        res.status(400).send(err.message);
    }

});


app.listen(PORT, () =>
{
    console.log(`[server] Running on http://localhost:${PORT}`);
});