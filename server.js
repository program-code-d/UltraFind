const express = require('express');
const crypto = require("crypto");
const mariadb = require('mariadb'); // 1. Import MariaDB
const app = express();
const PORT = 8080;
const multer = require('multer');
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

// 1. Configure where to save the files and what to name them
const storage = multer.diskStorage({
    destination: (req, file, cb) =>
    {
        cb(null, 'images/'); // Make sure this folder exists!
    },
    filename: (req, file, cb) =>
    {
        // Keeps the original name or adds a timestamp to avoid duplicates
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

function hashPassword(passw_string)
{
    return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

async function findFriend(body) {
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Get the salt
        const saltResult = await conn.query("SELECT salt FROM Users WHERE email = ?", [body.email]);
        if (saltResult.length === 0) return { success: false, error: "User not found" };
        
        const salt = saltResult[0].salt;
        const hashedPassword = hashPassword(body.password + salt);

        // 2. Verify Login
        const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
        const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
        
        // CRITICAL: Prevent crash if login fails
        if (userRows.length === 0) {
            return { success: false, error: "Authentication failed" };
        }
        const user_id = userRows[0].id;

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
        // FIXED: Uses the new Friendships table and body.selectedFriendId from your frontend
        const findQuery = "INSERT IGNORE INTO Friendships (user_id, friend_id) VALUES (?, ?)";
        const friend = await conn.query(findQuery, [user_id, friend_id]);

        // This finds friends where you are the sender OR the receiver
        const query = `SELECT first_name,last_name,id FROM Users WHERE id= ?`;
        const friends = await conn.query(query, [friend_id]);

        return { success: true, friends: friends, userExist: true };
    } catch (err)
    {
        console.error("Database error:", err);
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
            return { EmailFormat: false }
        }
        if (!user.email) throw new Error("Email is required");
        let salt = Math.trunc((Math.random() * (10099999 - 0) + 0) * 78 - 12.2)

        const hashedPassword = hashPassword(user.password + salt);

        conn = await pool.getConnection();

        const firstName = user.firstName || user.first_name;
        const lastName = user.lastName || user.last_name;
        // //const code=

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

        //  console.log("User logged in! Insert ID:", res.insertId);
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
            const insertQuery = "INSERT INTO Listings (user_id, title, description, price, location, age) VALUES (?, ?, ?, ?, ?, ?);";
            const res = await conn.query(insertQuery, [
                userId,           // This links the listing to the user
                body.name,
                body.description,
                body.pay,
                body.location,
                body.age
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
async function getMyListings(body)
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


        const insertQuery = "SELECT * FROM Listings WHERE user_id = ?;";
        const res = await conn.query(insertQuery, [userRows[0].id]);

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



        navbar =
            `
        <nav class="top-navbar">
            <div class="navbar-container">
                <div class="navbar-logo" onclick="goToDifferentScreen('index.html')">
                     <span>UltraFind</span>
                </div>
                <div class="navbar-links">
                    <div class="nav-item" onclick="goToDifferentScreen('index.html')">
                        <span><svg class="icon"><use href="icons.svg#house"></use></svg> 
                    </div>
                    <div class="nav-item" onclick="goToDifferentScreen('friends.html')">
                        <span><svg class="icon"><use href="icons.svg#user-friends"></use></svg></span></span>
                    </div>
                    <div class="nav-item" onclick="goToDifferentScreen('manage_listings.html')">
                        <span><svg class="icon"><use href="icons.svg#folder"></use></svg></span>
                    </div>
                </div>
            </div>
        </nav>
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


async function sendMessage(body)
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


        const selectQuery = "SELECT user_id FROM Listings WHERE id = ?;";
        const res = await conn.query(selectQuery, [body.listing_id]);

        const recieverId = res[0].user_id;
        const insertQuery = "INSERT INTO listingMessages (sender_id,receiver_id,listing_id,message_text) VALUES (?,?,?,?)";
        const result = await conn.query(insertQuery, [userRows[0].id, recieverId, body.listing_id, body.message]);

        //   console.log("Listing created! New Listing ID:", res.insertId);
        return { success: true, messages: res };

    } catch (err)
    {
        console.error(err)
        return { success: false, userExist: false }
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

        // FIXED: Table name and logic to see messages sent OR received
        const query = `
            SELECT message_text, sender_id 
            FROM DirectMessages 
            WHERE (sender_id = ? AND receiver_id = ?) 
            OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC`;
        const res = await conn.query(query, [userId, body.friend_id, body.friend_id, userId]);

        return { success: true, messages: res, userExist: true };
    } catch (err)
    {
        console.error(err);
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

        // FIXED: Joins Friendships with Users to get the friend's actual name
        const query = `
            SELECT u.id, u.first_name, u.last_name 
            FROM Users u
            JOIN Friendships f ON u.id = f.friend_id
            WHERE f.user_id = ?`;
        const res = await conn.query(query, [userId]);

        return { success: true, friendslist: res, userExist: true };
    } catch (err)
    {
        console.error(err);
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
        // Changed Table to DirectMessages and column to sender_id
        const insertQuery = "INSERT INTO DirectMessages (sender_id,receiver_id,message_text) VALUES (?,?,?)";
        const res = await conn.query(insertQuery, [SenderId, body.friend_id, body.message]);

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


        const insertQuery = "SELECT * FROM Listings WHERE id = ?;";
        const res = await conn.query(insertQuery, [body.id]);

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
        if ((result && result.emailExist) || (result.notunderage != undefined) || (result.EmailFormat != undefined))
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


app.post('/sendMessage', async (req, res) =>
{
    try
    {
        const result = await sendMessage(req.body);
        if (result && result.success)
        {
            res.json({ success: true }); // Simple success response
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

        // 1. Handle case where user authentication/existence fails
        if (result && !result.userExist)
        {
            return res.json({ success: false, message: "User not found or invalid credentials" });
        }

        // 2. Handle success: Wrap 'friends' in an object for frontend consistency
        if (result && result.success)
        {
            return res.json({
                success: true,
                friends: result.friends
            });
        }

        // 3. Fallback for unexpected results
        res.json({ success: false, error: "Unable to retrieve friends list" });

    } catch (err)
    {
        // Log the error for the developer and send the message to the client
        console.error("Route Error (/getfriends):", err);
        res.status(400).send(err.message);
    }
});

app.post('/addfriend', async (req, res) =>
{
    try
    {
        const result = await addfriend(req.body);

        // Handle user not found/password wrong
        if (result && !result.userExist)
        {
            return res.json({ success: false, message: "failed" });
        }

        // Handle success
        if (result && result.success)
        {
            // FIX: Wrap 'friends' in an object so frontend data.friends works!
            return res.json({ success: true, friends: result.friends });
        }

        // Handle potential edge cases where result might be weird
        res.json({ success: false, error: "Something went wrong" });

    } catch (err)
    {
        console.error(err);
        res.status(400).send(err.message);
    }
});


app.post('/getInfoListing', async (req, res) =>
{
    // console.log("Signup request:", req.body);
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
            res.json(result.listing)
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


app.post('/getMyListings', async (req, res) =>
{
    try
    {
        const result = await getMyListings(req.body);
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

app.post('/upload-listing', upload.single('listingImage'), (req, res) =>
{
    if (!req.file)
    {
        return res.status(400).send('No file uploaded.');
    }
    // You now have the path to save in your database!
    const imagePath = `/imges/${req.file.filename}`;
    res.json({ success: true, path: imagePath });
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

app.post('/getfriendmessages', async (req, res) =>
{

    try
    {
        const result = await getfriendmessages(req.body);
        if (result && !result.userExist)
        {
            return res.json({ message: "failed" })
        }
        if (result && result.success)
        {
            res.json(result.messages)
        }

    } catch (err)
    {
        res.status(400).send(err.message);
    }

});

app.post('/findFriend', async (req, res) =>
{
    // Calling the function you provided
    const result = await findFriend(req.body);

    // You MUST send a status code and the JSON back
    if (result.success)
    {
        res.status(200).json(result);
    } else
    {
        res.status(401).json(result);
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
})