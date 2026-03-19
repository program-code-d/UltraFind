const app = require('fastify')({
    logger: false,
    bodyLimit: 10485760
});
const crypto = require("crypto");
const mariadb = require('mariadb');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');


const PORT = 8080;
const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: 'chicken55441',
    database: 'test',
    connectionLimit: 5
});


async function setup()
{
    await app.register(require('@fastify/middie'));
    app.register(require('@fastify/formbody'));
    app.register(require('@fastify/static'), {
        root: __dirname,
        prefix: '/',
        index: false,
    });
    app.register(require('@fastify/multipart'));
}


function hashPassword(passw_string)
{
    return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

<<<<<<< HEAD

function isEmail(email)
{
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email);
}


async function findFriend(body)
{
=======
async function findFriend(body) {
>>>>>>> bc8aa2ed1a32d464cb6f6b4489d28cca8af9fb75
    let conn;
    try {
        conn = await pool.getConnection();
<<<<<<< HEAD
=======

        // 1. Get the salt
>>>>>>> bc8aa2ed1a32d464cb6f6b4489d28cca8af9fb75
        const saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        if (saltResult.length === 0) return { success: false, error: "User not found" };
        
        const salt = saltResult[0].salt;
        const hashedPassword = hashPassword(body.password + salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        
        // CRITICAL: Prevent crash if login fails
        if (userRows.length === 0) {
            return { success: false, error: "Authentication failed" };
        }
        const user_id = userRows[0].id;
<<<<<<< HEAD
        const findQuery = "SELECT id, first_name, last_name FROM Users WHERE id != ? AND CONCAT(first_name, ' ', last_name) LIKE ?;";
        const friends = await conn.query(findQuery, [user_id, `%${body.friendSearch}%`]);
        return { success: true, friends: friends, userExist: true };
    } catch (err)
    {
        console.error(err);
=======

        // 3. Search for friends
        const findQuery = `
            SELECT id, first_name, last_name 
            FROM Users 
            WHERE id != ? 
            AND CONCAT(first_name, ' ', last_name) LIKE ?;
        `;
        
        // Ensure friendSearch exists, default to empty string if not
        const searchTerm = body.friendSearch || "";
        const friends = await conn.query(findQuery, [user_id, `%${searchTerm}%`]);

        // Return results (ensure it's a clean array)
        return { success: true, friends: [...friends], userExist: true };

    } catch (err) {
        console.error("Database error:", err);
>>>>>>> bc8aa2ed1a32d464cb6f6b4489d28cca8af9fb75
        return { success: false, error: "Internal Server Error" };
    } finally {
        if (conn) conn.release();
    }
}


async function addfriend(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();
        const saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const salt = saltResult[0].salt;
        const hashedPassword = hashPassword(body.password + salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const user_id = userRows[0].id;
        const friend_id = Number(body.selectedFriendId);
        const findQuery = "INSERT IGNORE INTO Friendships (user_id, friend_id) VALUES (?, ?)";
        await conn.query(findQuery, [user_id, friend_id]);
        const query = `SELECT first_name,last_name,id FROM Users WHERE id= ?`;
        const friends = await conn.query(query, [friend_id]);
        return { success: true, friends: friends, userExist: true };
    } catch (err)
    {
        console.error(err);
        return { success: false, error: "Internal Server Error" };
    } finally
    {
        if (conn) conn.release();
    }
}


async function registerUser(user)
{
    let conn;
    try
    {
        if (user.age < 13)
        {
            return { notunderage: false };
        }
        if (!isEmail(user.email))
        {
            return { EmailFormat: false };
        }
        let salt = Math.trunc((Math.random() * (10099999 - 0) + 0) * 78 - 12.2);
        const hashedPassword = hashPassword(user.password + salt);
        conn = await pool.getConnection();
        const firstName = user.firstName || user.first_name;
        const lastName = user.lastName || user.last_name;
        const query = "INSERT INTO Users (first_name,last_name,email,password,age,location,salt) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const res = await conn.query(query, [firstName, lastName, user.email, hashedPassword, user.age, "", salt]);
        return { success: true, emailExist: false };
    } catch (err)
    {
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


async function login(user)
{
    let conn;
    try
    {
        if (!isEmail(user.email))
        {
            return { success: "false", notEmailFormat: true };
        }
        conn = await pool.getConnection();
        let query = "SELECT salt FROM Users WHERE email = ?;";
        let salt = await conn.query(query, [user.email]);
        const hashedPassword = hashPassword(user.password + salt[0].salt);
        query = "SELECT email, password FROM Users WHERE email = ? AND password = ?;";
        const res = await conn.query(query, [user.email, hashedPassword]);
        return { success: true, userExist: res.length > 0 };
    } catch (err)
    {
        return { success: false, userExist: false };
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
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        if (userRows.length > 0)
        {
            const userId = userRows[0].id;
            const insertQuery = "INSERT INTO Listings (user_id, title, description, price, location, age) VALUES (?, ?, ?, ?, ?, ?);";
            const res = await conn.query(insertQuery, [userId, body.name, body.description, body.pay, body.location, body.age]);
            return { success: true, userExist: true, listingId: res.insertId };
        } else
        {
            return { success: false, message: "Invalid login" };
        }
    } catch (err)
    {
        return { success: false, userExist: false };
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
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const insertQuery = "SELECT * FROM Listings WHERE title LIKE ?;";
        const res = await conn.query(insertQuery, [`%${body.search}%`]);
        return { success: true, listings: res, userExist: true };
    } catch (err)
    {
        return { success: false, userExist: false };
    } finally
    {
        if (conn) conn.release();
    }
}


async function getMyListings(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const insertQuery = "SELECT * FROM Listings WHERE user_id = ?;";
        const res = await conn.query(insertQuery, [userRows[0].id]);
        return { success: true, listings: res, userExist: true };
    } catch (err)
    {
        return { success: false, userExist: false };
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
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const navbar = `<nav class="top-navbar"><div class="navbar-container"><div class="navbar-logo" onclick="goToDifferentScreen('index.html')"><span>UltraFind</span></div><div class="navbar-links"><div class="nav-item" onclick="goToDifferentScreen('index.html')"><span><svg class="icon"><use href="icons.svg#house"></use></svg></span></div><div class="nav-item" onclick="goToDifferentScreen('friends.html')"><span><svg class="icon"><use href="icons.svg#user-friends"></use></svg></span></div><div class="nav-item" onclick="goToDifferentScreen('manage_listings.html')"><span><svg class="icon"><use href="icons.svg#folder"></use></svg></span></div></div></div></nav>`;
        return { success: true, navbar: navbar, userExist: true };
    } catch (err)
    {
        return { success: false, userExist: false };
    } finally
    {
        if (conn) conn.release();
    }
}


async function sendMessage(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const selectQuery = "SELECT user_id FROM Listings WHERE id = ?;";
        const res = await conn.query(selectQuery, [body.listing_id]);
        const recieverId = res[0].user_id;
        const insertQuery = "INSERT INTO listingMessages (sender_id,receiver_id,listing_id,message_text) VALUES (?,?,?,?)";
        await conn.query(insertQuery, [userRows[0].id, recieverId, body.listing_id, body.message]);
        return { success: true, messages: res };
    } catch (err)
    {
        return { success: false, userExist: false };
    } finally
    {
        if (conn) conn.release();
    }
}


async function getfriendmessages(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const userId = userRows[0].id;
        const query = "SELECT message_text, sender_id FROM DirectMessages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC";
        const res = await conn.query(query, [userId, body.friend_id, body.friend_id, userId]);
        return { success: true, messages: res, userExist: true };
    } catch (err)
    {
        return { success: false, userExist: false };
    } finally
    {
        if (conn) conn.release();
    }
}


async function getFriends(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const userId = userRows[0].id;
        const query = "SELECT u.id, u.first_name, u.last_name FROM Users u JOIN Friendships f ON u.id = f.friend_id WHERE f.user_id = ?";
        const res = await conn.query(query, [userId]);
        return { success: true, friendslist: res, userExist: true };
    } catch (err)
    {
        return { success: false, userExist: false };
    } finally
    {
        if (conn) conn.release();
    }
}


async function sendfriendmessage(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const SenderId = userRows[0].id;
        const insertQuery = "INSERT INTO DirectMessages (sender_id,receiver_id,message_text) VALUES (?,?,?)";
        const res = await conn.query(insertQuery, [SenderId, body.friend_id, body.message]);
        return { success: true, listing: res, userExist: true };
    } catch (err)
    {
        return { success: false, userExist: false };
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


async function getinfolistings(body)
{
    let conn;
    try
    {
        conn = await pool.getConnection();
        let saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        const hashedPassword = hashPassword(body.password + saltResult[0].salt);
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        const insertQuery = "SELECT * FROM Listings WHERE id = ?;";
        const res = await conn.query(insertQuery, [body.id]);
        return { success: true, listing: res, userExist: true };
    } catch (err)
    {
        return { success: false, userExist: false };
    } finally
    {
        if (conn) conn.release();
    }
}


app.get('/', (req, res) =>
{
    res.sendFile('intro.html');
});


app.post('/signup', async (req, res) =>
{
    try
    {
        const result = await registerUser(req.body);
        if ((result && result.emailExist) || (result.notunderage != undefined) || (result.EmailFormat != undefined))
        {
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.redirect("/index.html");
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/sendMessage', async (req, res) =>
{
    try
    {
        const result = await sendMessage(req.body);
        if (result && result.success)
        {
            res.send({ success: true });
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/getfriends', async (req, res) =>
{
    try
    {
        const result = await getFriends(req.body);
        if (result && !result.userExist)
        {
            return res.send({ success: false, message: "failed" });
        }
        if (result && result.success)
        {
            return res.send({ success: true, friends: result.friendslist });
        }
        res.send({ success: false });
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/addfriend', async (req, res) =>
{
    try
    {
        const result = await addfriend(req.body);
        if (result && !result.userExist)
        {
            return res.send({ success: false, message: "failed" });
        }
        if (result && result.success)
        {
            return res.send({ success: true, friends: result.friends });
        }
        res.send({ success: false });
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/getInfoListing', async (req, res) =>
{
    try
    {
        const result = await getinfolistings(req.body);
        if (result && !result.userExist)
        {
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.send(result.listing);
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/login', async (req, res) =>
{
    try
    {
        const result = await login(req.body);
        if (result && result.notEmailFormat)
        {
            return res.send({ message: "NotEmailFormat" });
        }
        if (result && !result.userExist)
        {
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.redirect("/index.html");
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/createListing', async (req, res) =>
{
    try
    {
        const result = await createListing(req.body);
        if (result && !result.userExist)
        {
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.redirect("/index.html");
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
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.send(result.listings);
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/getMyListings', async (req, res) =>
{
    try
    {
        const result = await getMyListings(req.body);
        if (result && !result.userExist)
        {
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.send(result.listings);
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


app.post('/upload-listing', async (req, res) =>
{
    try
    {
        const data = await req.file();
        if (!data)
        {
            return res.status(400).send('No file uploaded.');
        }
        const uniqueName = Date.now() + '-' + data.filename;
        await pipeline(data.file, fs.createWriteStream(path.join(__dirname, 'images', uniqueName)));
        res.send({ success: true, path: `/images/${uniqueName}` });
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
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.send(result.navbar);
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/getfriendmessages', async (req, res) =>
{
    try
    {
        const result = await getfriendmessages(req.body);
        if (result && !result.userExist)
        {
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.send(result.messages);
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


app.post('/findFriend', async (req, res) =>
{
    const result = await findFriend(req.body);
    if (result.success)
    {
        res.status(200).send(result);
    } else
    {
        res.status(401).send(result);
    }
});


app.post('/sendfriendmessage', async (req, res) =>
{
    try
    {
        const result = await sendfriendmessage(req.body);
        if (result && !result.userExist)
        {
            return res.send({ message: "failed" });
        }
        if (result && result.success)
        {
            res.send(result.listing);
        }
    } catch (err)
    {
        res.status(400).send(err.message);
    }
});


const start = async () =>
{
    await setup();
    try
    {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`[Find Server] Running on http://localhost:${PORT}`);
    } catch (err)
    {
        console.error(err);
        process.exit(1);
    }
};

start();