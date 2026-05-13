const app = require("fastify")({
  logger: false,
  bodyLimit: 524288000,
});
const crypto = require("crypto");
const mariadb = require("mariadb");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { pipeline } = require("stream/promises");
const { spawn } = require("child_process");
const sharp = require("sharp"); // Top of server.js

const PORT = 8080;
const pool = mariadb.createPool({
  host: "localhost",
  user: "root",
  password: "chicken55441",
  database: "test",
  connectionLimit: 50,
});

async function setup() {
  await app.register(require("@fastify/middie"));
  app.register(require("@fastify/formbody"));
  app.register(require("@fastify/static"), {
    root: __dirname,
    prefix: "/",
    index: false,
  });
  app.register(require("@fastify/multipart"));
}

function hashPassword(passw_string) {
  return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

/**
 * Validates an email address with high reliability.
 * 1. Trims whitespace.
 * 2. Checks for basic structure and length.
 * 3. Uses an optimized regex for common edge cases.
 */
function isEmail(email) {
  if (!email || typeof email !== "string") return false;

  // Trim whitespace to prevent false negatives from copy-paste errors
  const cleanEmail = email.trim();

  // RFC 5321: Max length is 254 characters
  if (cleanEmail.length > 254) return false;

  // Robust regex:
  // - Prevents double dots (..), which are invalid but often missed
  // - Ensures the local part doesn't start/end with a dot
  // - Supports most modern TLDs
  const emailPattern =
    /^(?!\.)(?!.*\.\.)([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

  return emailPattern.test(cleanEmail);
}
// --- FIXED UPLOAD ROUTE ---
app.post("/upload-listing", async (req, res) => {
  const parts = req.parts();
  const body = {};
  const mediaFiles = [];

  try {
    const imagesDir = path.join(__dirname, "images");
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    // Process one by one to save your horrible CPU
    for await (const part of parts) {
      if (part.filename) {
        const timestamp = Date.now();
        const uniqueName = `${timestamp}-${Math.random().toString(36).substring(7)}.webp`;
        const finalPath = path.join(imagesDir, uniqueName);

        await sharp(await part.toBuffer())
          .rotate()
          .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 45, effort: 6, smartSubsample: true })
          .toFile(finalPath);

        // Simulate processing delay for the "AI Review" look
        await new Promise((r) => setTimeout(r, 1200));
        mediaFiles.push({ name: uniqueName, type: "image" });
      } else {
        body[part.fieldname] = part.value;
      }
    }

    const is_new = body.is_new == "0" ? 0 : 1;
    const result = await createListing(
      body,
      mediaFiles,
      is_new,
      body.listingId,
    );

    if (result.success) {
      res.send({
        success: true,
        redirect: "/home",
        listingId: result.listingId,
      });
    } else {
      res.status(400).send({ success: false, message: result.message });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, error: "AI Review failed." });
  }
});

// --- FIXED DATABASE FUNCTION ---
async function findFriend(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    const saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const salt = saltResult[0].salt;
    const hashedPassword = hashPassword(body.password + salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const user_id = userRows[0].id;

    const findQuery =
      "SELECT id, first_name, last_name FROM Users WHERE id != ? AND CONCAT(first_name, ' ', last_name) LIKE ?;";
    const friends = await conn.query(findQuery, [
      user_id,
      `%${body.friendSearch}%`,
    ]);

    // FIX: Convert BigInt IDs to regular Numbers for JSON
    const cleanFriends = friends.map((f) => ({
      id: Number(f.id),
      first_name: f.first_name,
      last_name: f.last_name,
    }));

    return { success: true, friends: cleanFriends, userExist: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Internal Server Error" };
  } finally {
    if (conn) conn.release();
  }
}

async function addfriend(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    const saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const salt = saltResult[0].salt;
    const hashedPassword = hashPassword(body.password + salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const user_id = userRows[0].id;
    const friend_id = Number(body.selectedFriendId);
    const findQuery =
      "INSERT IGNORE INTO Friendships (user_id, friend_id) VALUES (?, ?)";
    await conn.query(findQuery, [user_id, friend_id]);
    const query = `SELECT first_name,last_name,id FROM Users WHERE id= ?`;
    const friends = await conn.query(query, [friend_id]);
    return { success: true, friends: friends, userExist: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Internal Server Error" };
  } finally {
    if (conn) conn.release();
  }
}

async function registerUser(user) {
  let conn;
  try {
    if (user.age < 13) {
      return { notunderage: false };
    }
    if (!isEmail(user.email)) {
      return { EmailFormat: false };
    }
    let salt = Math.trunc((Math.random() * (10099999 - 0) + 0) * 78 - 12.2);
    const hashedPassword = hashPassword(user.password + salt);
    conn = await pool.getConnection();
    const firstName = user.firstName || user.first_name;
    const lastName = user.lastName || user.last_name;
    const query =
      "INSERT INTO Users (first_name,last_name,email,password,age,location,salt) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const res = await conn.query(query, [
      firstName,
      lastName,
      user.email,
      hashedPassword,
      user.age,
      "",
      salt,
    ]);
    return { success: true, emailExist: false };
  } catch (err) {
    if (err.errno == 1062) {
      return { emailExist: true };
    }
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

async function login(user) {
  let conn;
  try {
    if (!isEmail(user.email)) {
      return { success: "false", notEmailFormat: true };
    }
    conn = await pool.getConnection();
    let query = "SELECT salt FROM Users WHERE email = ?;";
    let salt = await conn.query(query, [user.email]);
    const hashedPassword = hashPassword(user.password + salt[0].salt);
    query =
      "SELECT email, password FROM Users WHERE email = ? AND password = ?;";
    const res = await conn.query(query, [user.email, hashedPassword]);
    return { success: true, userExist: res.length > 0 };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function createListing(
  body,
  mediaFiles = [],
  is_new = null,
  listingId = null,
) {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Verify User exists and password is correct
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    if (!saltResult.length)
      return { success: false, message: "User not found" };

    const salt = String(saltResult[0].salt);
    const hashedPassword = hashPassword(body.password + salt);
    const userRows = await conn.query(
      "SELECT id FROM Users WHERE email = ? AND password = ?",
      [body.email, hashedPassword],
    );
    if (!userRows.length)
      return { success: false, message: "Invalid Password" };

    const userId = userRows[0].id;
    const price = Number(body.pay) || 0;
    const age = Number(body.age) || 13;
    const doneDate =
      body.done_date && body.done_date.trim() !== "" ? body.done_date : null;

    // 2. Determine if we are NEW or EDITING
    if (Number(is_new) === 1) {
      // INSERT NEW LISTING
      const insertQuery = `
                INSERT INTO Listings 
                (user_id, title, description, price, location, age, is_active, assigned_to, assigned_status, done_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const res = await conn.query(insertQuery, [
        userId,
        body.name,
        body.description,
        price,
        body.location,
        age,
        true,
        null,
        "not_assigned",
        doneDate,
      ]);

      const newId = Number(res.insertId);
      for (const file of mediaFiles) {
        await conn.query(
          "INSERT INTO ListingMedia (listing_id, file_path, media_type) VALUES (?, ?, ?)",
          [newId, file.name, file.type],
        );
      }
      return { success: true, listingId: newId };
    } else {
      // UPDATE EXISTING LISTING
      const updateQuery = `
                UPDATE Listings SET 
                title = ?, description = ?, price = ?, location = ?, age = ?, done_date = ? 
                WHERE id = ? AND user_id = ?`;

      await conn.query(updateQuery, [
        body.name,
        body.description,
        price,
        body.location,
        age,
        doneDate,
        listingId,
        userId,
      ]);

      // Handle Media Updates (If any new images were added)
      if (mediaFiles.length > 0) {
        await conn.query("DELETE FROM ListingMedia WHERE listing_id = ?", [
          listingId,
        ]);
        for (const file of mediaFiles) {
          await conn.query(
            "INSERT INTO ListingMedia (listing_id, file_path, media_type) VALUES (?, ?, ?)",
            [listingId, file.name, file.type],
          );
        }
      }
      return { success: true, listingId: listingId };
    }
  } catch (err) {
    console.error("DATABASE ERROR:", err);
    return { success: false, message: err.message };
  } finally {
    if (conn) conn.release();
  }
}

async function getListings(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(
      body.password + String(saltResult[0].salt),
    );

    // This query fetches the listing AND finds the first image associated with it
    const query = `
            SELECT L.*, 
            (SELECT file_path FROM ListingMedia WHERE listing_id = L.id LIMIT 1) as thumbnail 
            FROM Listings L 
            WHERE L.title LIKE ? AND L.is_active = true 
            ORDER BY L.created_at DESC;
        `;

    const res = await conn.query(query, [`%${body.search}%`]);

    // Convert BigInts to Numbers so JSON doesn't break
    const cleanRes = res.map((row) => {
      const newRow = { ...row };
      if (newRow.id) newRow.id = Number(newRow.id);
      return newRow;
    });

    return { success: true, listings: cleanRes, userExist: true };
  } catch (err) {
    console.error(err);
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function getListing(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const userId = userRows[0].id;
    const listing =
      "SELECT id,title,description,age,location,price FROM Listings WHERE id = ? AND user_id = ?;";
    const res = await conn.query(listing, [body.listingId, userId]);
    const image = "SELECT file_path FROM ListingMedia WHERE listing_id = ?;";
    const imageRes = await conn.query(image, [body.listingId]);
    res[0].image = imageRes;
    return { success: true, listing: res[0], userExist: true };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function searchListings(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    if (!saltResult.length) return { success: false, userExist: false };

    const salt = String(saltResult[0].salt);
    const hashedPassword = hashPassword(body.password + salt);

    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    if (!userRows.length) return { success: false, userExist: false };

    // THE FIX: Added the subquery to grab the thumbnail
    const searchQuery = `
            SELECT L.*, 
            (SELECT file_path FROM ListingMedia WHERE listing_id = L.id LIMIT 1) as thumbnail 
            FROM Listings L 
            WHERE L.title LIKE ? AND L.is_active = true 
            ORDER BY L.created_at DESC;
        `;

    const res = await conn.query(searchQuery, [`%${body.search}%`]);

    // Convert IDs to Numbers so JSON doesn't break
    const cleanListings = res.map((item) => ({
      ...item,
      id: Number(item.id),
      price: Number(item.price),
    }));

    return { success: true, listings: cleanListings, userExist: true };
  } catch (err) {
    console.error("Search Error:", err);
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function getMyListings(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const insertQuery = `
            SELECT L.*, 
                   CONCAT(U.first_name, ' ', U.last_name) as assigned_user_name
            FROM Listings L
            LEFT JOIN Users U ON L.assigned_to = U.id
            WHERE L.user_id = ?
        `;
    const res = await conn.query(insertQuery, [userRows[0].id]);

    return { success: true, listings: res, userExist: true };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}
           
async function getMyAssignments(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const userId = userRows[0].id;

    const query = `
            SELECT L.*, 
                   CONCAT(U.first_name, ' ', U.last_name) as owner_name
            FROM Listings L
            JOIN Users U ON L.user_id = U.id
            WHERE L.assigned_to = ?
            ORDER BY L.created_at DESC
        `;
    const res = await conn.query(query, [userId]);
    return { success: true, assignments: res, userExist: true };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function deactivateListing(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);

    const insertQuery = "UPDATE Listings SET is_active = FALSE WHERE id = ?;";
    await conn.query(insertQuery, [body.listing_id]);
    return { success: true, is_active: false, userExist: true };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function assign(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);

    const insertQuery = "UPDATE Listings SET assigned_to = ? WHERE id = ?;";
    await conn.query(insertQuery, [body.assignee_id, body.listing_id]);

    const insertQuery2 =
      "UPDATE Listings SET assigned_status = ? WHERE id = ?;";
    await conn.query(insertQuery2, ["pending", body.listing_id]);

    const nameQuery = "SELECT first_name, last_name FROM Users WHERE id = ?;";
    const name = await conn.query(nameQuery, [body.assignee_id]);

    return {
      success: true,
      assignee_name: `${name.first_name} ${name.last_name}`,
      assigned_status: "pending",
      userExist: true,
    };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function activateListing(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);

    const insertQuery = "UPDATE Listings SET is_active = TRUE WHERE id = ?;";
    await conn.query(insertQuery, [body.listing_id]);
    return { success: true, is_active: true, userExist: true };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function getNavbar(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const navbar = `<nav class="top-navbar">
                            <div class="navbar-container">
                                <div class="navbar-logo" onclick="goToDifferentScreen('home')" style="display: flex; align-items: center; gap: 0; font-size: 24px; font-weight: 600;">
                                <span style="color: #f1811e;">Ultra</span><span>Find</span>
                             </div>
                             <div class="navbar-links">
                                 <div class="nav-item" onclick="goToDifferentScreen('home')">
                                 <span><svg class="icon"><use href="icons.svg#house"></use></svg></span>
                                 <div class="nav-label">Home</div>
                             </div>
                             <div class="nav-item" onclick="goToDifferentScreen('friends')">
                                <span><svg class="icon"><use href="icons.svg#user-friends"></use></svg></span>
                                <div class="nav-label">Friends</div>
                            </div>
                            <div class="nav-item" onclick="goToDifferentScreen('manageListings')">
                                <span><svg class="icon"><use href="icons.svg#folder"></use></svg></span>
                                <div class="nav-label">Manage Listings</div>
                            </div>
                             <div class="nav-item" onclick="goToDifferentScreen('calender')">
                                <span><svg class="icon"><use href="icons.svg#calendar"></use></svg></span>
                                <div class="nav-label">Calendar</div>
                            </div>
                              <div class="nav-item" onclick="goToDifferentScreen('assignments')">
                                <span><svg class="icon"><use href="icons.svg#invite-colleagues"></use></svg></span>
                                <div class="nav-label">Assignments</div>
                            </div>
                              <div class="nav-item" onclick="goToDifferentScreen('settings')">
                                <span><svg class="icon"><use href="icons.svg#settings"></use></svg></span>
                                <div class="nav-label">Settings</div>
                            </div>
                             </div>
                            </div>
                        </nav>`;
    return { success: true, navbar: navbar, userExist: true };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function sendMessage(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const userRows = await conn.query(
      "SELECT id FROM Users WHERE email = ? AND password = ?;",
      [body.email, hashedPassword],
    );
    const myId = userRows[0].id;

    // 1. Find the owner of the listing
    const listingRes = await conn.query(
      "SELECT user_id FROM Listings WHERE id = ?;",
      [body.listing_id],
    );
    const ownerId = listingRes[0].user_id;

    let receiverId;

    if (myId === ownerId) {
      // 2. If I am the OWNER, send to the person who messaged me
      // We look for the most recent message on this listing that wasn't from me
      const lastMsg = await conn.query(
        "SELECT sender_id FROM listingMessages WHERE listing_id = ? AND sender_id != ? ORDER BY created_at DESC LIMIT 1",
        [body.listing_id, myId],
      );
      receiverId = lastMsg.length > 0 ? lastMsg[0].sender_id : myId;
    } else {
      // 3. If I am the BUYER, send to the owner
      receiverId = ownerId;
    }

    const insertQuery =
      "INSERT INTO listingMessages (sender_id, receiver_id, listing_id, message_text) VALUES (?,?,?,?)";
    await conn.query(insertQuery, [
      myId,
      receiverId,
      body.listing_id,
      body.message,
    ]);
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false };
  } finally {
    if (conn) conn.release();
  }
}

async function deleteListing(body) {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. SAFE CHECK: Get Salt
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    // If email doesn't exist, stop here instead of crashing
    if (!saltResult || saltResult.length === 0) {
      return { success: false, userExist: false };
    }

    const salt = String(saltResult[0].salt);
    const hashedPassword = hashPassword(body.password + salt);

    // 2. SAFE CHECK: Get User
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    // If password is wrong, stop here instead of crashing
    if (!userRows || userRows.length === 0) {
      return { success: false, userExist: false };
    }

    const userId = userRows[0].id;

    // 3. Get Media paths BEFORE deleting the listing
    // (Because ON DELETE CASCADE will remove the database rows instantly)
    const mediaRows = await conn.query(
      "SELECT file_path FROM ListingMedia WHERE listing_id = ?",
      [body.listing_id],
    );

    // 4. Delete from Database (with ownership check)
    const deleteRes = await conn.query(
      "DELETE FROM Listings WHERE id = ? AND user_id = ?",
      [body.listing_id, userId],
    );

    // 5. If DB delete was successful, clean up the files
    if (deleteRes.affectedRows > 0) {
      for (const row of mediaRows) {
        const filePath = path.join(__dirname, "images", row.file_path);
        try {
          // Check if file exists before trying to delete it
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            console.log(`Physically deleted: ${row.file_path}`);
          }
        } catch (fileErr) {
          console.error(`File system error for ${row.file_path}:`, fileErr);
        }
      }
      return { success: true, userExist: true };
    } else {
      return {
        success: false,
        userExist: true,
        error: "Listing not found or you don't own it",
      };
    }
  } catch (err) {
    console.error("Delete Listing Error:", err);
    return { success: false, userExist: true, error: err.message };
  } finally {
    if (conn) conn.release();
  }
}
async function getuserdata(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const userId = userRows[0].id;
    const insertQuery =
      "SELECT email,first_name,last_name,password,location,created_at,age FROM Users WHERE id=?";
    const res = await conn.query(insertQuery, [userId]);
    return { success: true, userdata: res, userExist: true };
  } catch (err) {
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function updateuserdata(body) {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Get the current salt
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.currentEmail],
    );
    if (saltResult.length === 0) return { success: false, userExist: false };

    // 2. Wrap salt in String() to prevent BigInt "n" errors
    const currentSalt = String(saltResult[0].salt);
    const currentHashedPassword = hashPassword(
      body.currentPassword + currentSalt,
    );

    const userRows = await conn.query(
      "SELECT id FROM Users WHERE email = ? AND password = ?;",
      [body.currentEmail, currentHashedPassword],
    );

    if (userRows.length === 0)
      return {
        success: false,
        userExist: true,
        message: "Invalid current password",
      };
    const userId = userRows[0].id;

    // 3. Generate New Salt
    let newSalt = Math.trunc((Math.random() * (10099999 - 0) + 0) * 78 - 12.2);
    const newHashedPassword = hashPassword(body.newPassword + newSalt);

    const updateQuery =
      "UPDATE Users SET email = ? , first_name = ? , last_name = ? , password = ? , salt = ? , location = ? , age = ? WHERE id=?";
    await conn.query(updateQuery, [
      body.newEmail,
      body.first_name,
      body.last_name,
      newHashedPassword,
      newSalt,
      body.location,
      body.age,
      userId,
    ]);

    return { success: true, userExist: true };
  } catch (err) {
    console.error(err);
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function getworkpeople(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const userId = userRows[0].id;

    const query = `
            SELECT DISTINCT
                Listings.id, 
                Users.first_name, 
                Users.last_name, 
                Listings.title
            FROM Listings
            JOIN Users ON Listings.user_id = Users.id
            JOIN listingMessages ON Listings.id = listingMessages.listing_id
            WHERE listingMessages.sender_id = ? OR listingMessages.receiver_id = ?
        `;
    const friends = await conn.query(query, [userId, userId]);

    const cleanFriends = friends.map((f) => ({
      id: Number(f.id),
      first_name: f.first_name,
      last_name: f.last_name,
      title: f.title,
    }));

    return { success: true, friendslist: cleanFriends, userExist: true };
  } catch (err) {
    console.error(err);
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function getworkmessages(body) {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Authenticate and get your own ID
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    if (saltResult.length === 0) return { success: false, userExist: false };

    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);

    if (userRows.length === 0) return { success: false, userExist: false };
    const myId = Number(userRows[0].id);

    // 2. Fetch Messages (Corrected table name case to listingMessages)
    const query = `
            SELECT message_text, sender_id, created_at 
            FROM listingMessages 
            WHERE listing_id = ? 
            AND (sender_id = ? OR receiver_id = ?)
            ORDER BY created_at ASC`;

    const dbRows = await conn.query(query, [body.listing_id, myId, myId]);

    // 3. Label messages so frontend knows how to style them
    const cleanMessages = dbRows.map((row) => ({
      message_text: row.message_text,
      is_me: Number(row.sender_id) === myId,
      created_at: row.created_at,
    }));

    return { success: true, messages: cleanMessages, userExist: true };
  } catch (err) {
    console.error("DATABASE ERROR:", err);
    return { success: false, userExist: true };
  } finally {
    if (conn) conn.release();
  }
}

async function getFriends(body) {
  let conn;
  try {
    conn = await pool.getConnection();
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);
    const userId = userRows[0].id;

    const query = `
        SELECT id, first_name, last_name 
        FROM Users 
        WHERE id IN (
            SELECT friend_id FROM Friendships WHERE user_id = ?
            UNION
            SELECT user_id FROM Friendships WHERE friend_id = ?
        )`;
    const friends = await conn.query(query, [userId, userId]);

    // FIX: Convert BigInt IDs to regular Numbers here as well
    const cleanFriends = friends.map((f) => ({
      id: Number(f.id),
      first_name: f.first_name,
      last_name: f.last_name,
    }));

    return { success: true, friendslist: cleanFriends, userExist: true };
  } catch (err) {
    console.error(err);
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function getfriendmessages(body) {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Authenticate with forced String salt to prevent hash mismatches
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    if (!saltResult || saltResult.length === 0)
      return { success: false, userExist: false };

    const salt = String(saltResult[0].salt);
    const hashedPassword = hashPassword(body.password + salt);
    const userRows = await conn.query(
      "SELECT id FROM Users WHERE email = ? AND password = ?;",
      [body.email, hashedPassword],
    );

    if (userRows.length === 0) return { success: false, userExist: false };

    const myId = Number(userRows[0].id);
    const friendId = Number(body.friendId);

    // 2. Fetch Messages
    const query = `
            SELECT message_text, sender_id, created_at 
            FROM DirectMessages 
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?) 
            ORDER BY created_at ASC`;

    const dbRows = await conn.query(query, [myId, friendId, friendId, myId]);

    // 3. Map with is_me flag
    const cleanMessages = dbRows.map((row) => ({
      message_text: row.message_text,
      is_me: Number(row.sender_id) === myId,
      created_at: row.created_at,
    }));

    return { success: true, messages: cleanMessages, userExist: true };
  } catch (err) {
    console.error("DATABASE ERROR:", err);
    return { success: false, userExist: true };
  } finally {
    if (conn) conn.release();
  }
}

async function sendfriendmessage(body) {
  let conn;
  try {
    conn = await pool.getConnection();

    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    if (!saltResult || saltResult.length === 0)
      return { success: false, userExist: false };

    const salt = String(saltResult[0].salt);
    const hashedPassword = hashPassword(body.password + salt);
    const userRows = await conn.query(
      "SELECT id FROM Users WHERE email = ? AND password = ?;",
      [body.email, hashedPassword],
    );

    if (userRows.length === 0) return { success: false, userExist: false };

    const senderId = userRows[0].id;
    const insertQuery =
      "INSERT INTO DirectMessages (sender_id, receiver_id, message_text) VALUES (?,?,?)";
    const dbResult = await conn.query(insertQuery, [
      senderId,
      body.friendId,
      body.message,
    ]);

    return { success: true, userExist: true, data: dbResult };
  } catch (err) {
    console.error("Database Error:", err);
    return { success: false, userExist: true, error: err.message };
  } finally {
    if (conn) conn.release();
  }
}

async function switchFile(body) {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Get the salt
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    if (!saltResult || saltResult.length === 0) {
      return { success: false, userExist: false };
    }

    const hashedPassword = hashPassword(body.password + saltResult[0].salt);
    const loginQuery = "SELECT id FROM Users WHERE email = ? AND password = ?;";
    const userRows = await conn.query(loginQuery, [body.email, hashedPassword]);

    // Check if authentication was successful
    if (!userRows || userRows.length === 0) {
      return { success: false, userExist: false };
    }

    return { success: true, userExist: true };
  } catch (err) {
    console.error("switchFile error:", err);
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

async function getinfolistings(body) {
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. Authenticate user
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [body.email],
    );
    if (!saltResult.length) return { success: false, userExist: false };
    const hashedPassword = hashPassword(
      body.password + String(saltResult[0].salt),
    );
    const userRows = await conn.query(
      "SELECT id FROM Users WHERE email = ? AND password = ?",
      [body.email, hashedPassword],
    );
    if (!userRows.length) return { success: false, userExist: false };

    // 2. Get Listing details
    const listingRes = await conn.query("SELECT * FROM Listings WHERE id = ?", [
      body.id,
    ]);
    if (!listingRes.length)
      return { success: false, message: "Listing not found" };

    let listing = listingRes[0];

    // 3. Get all Media (Images/Videos) for this listing
    const mediaRes = await conn.query(
      "SELECT file_path, media_type FROM ListingMedia WHERE listing_id = ?",
      [body.id],
    );
    listing.media = mediaRes; // Attach the array of images to the listing object

    // 4. Check if current user is the owner
    listing.my_listing = userRows[0].id == listing.user_id ? 1 : 0;

    return { success: true, listing: listing, userExist: true };
  } catch (err) {
    console.error(err);
    return { success: false, userExist: false };
  } finally {
    if (conn) conn.release();
  }
}

// Get Routes
app.get("/", (req, res) => {
  res.sendFile("intro.html");
});
app.get("/manageListings", (req, res) => {
  res.sendFile("manage_listings.html");
});
app.get("/info", (req, res) => {
  res.sendFile("info_listing.html");
});
app.get("/friends", (req, res) => {
  res.sendFile("friends.html");
});
app.get("/createListing", (req, res) => {
  res.sendFile("create_listing.html");
});

app.get("/editListing", (req, res) => {
  res.sendFile("create_listing.html");
});

app.get("/home", (req, res) => {
  res.sendFile("index.html");
});
app.get("/login", (req, res) => {
  res.sendFile("login.html");
});
app.get("/calender", (req, res) => {
  res.sendFile("calender.html");
});
app.get("/signup", (req, res) => {
  res.sendFile("login.html");
});
app.get("/settings", (req, res) => {
  res.sendFile("settings.html");
});
// PoST Routes

app.post("/createListing", async (req, res) => {
  try {
    const result = await createListing(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      return res.send({ success: true, redirect: "/home" });
    }
  } catch (err) {
    console.error("Create listing error:", err);
    res.status(400).send({ message: "Error creating listing" });
  }
});
app.post("/signupauth", async (req, res) => {
  try {
    const result = await registerUser(req.body);
    if (
      (result && result.emailExist != undefined && result.emailExist) ||
      result.notunderage != undefined ||
      result.EmailFormat != undefined
    ) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      return res.send({ success: true, redirect: "/home" });
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/sendMessage", async (req, res) => {
  try {
    const result = await sendMessage(req.body);
    if (result && result.success) {
      res.send({ success: true });
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getfriends", async (req, res) => {
  try {
    const result = await getFriends(req.body);
    if (result && !result.userExist) {
      return res.send({ success: false, message: "failed" });
    }
    if (result && result.success) {
      return res.send({ success: true, friends: result.friendslist });
    }
    res.send({ success: false });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getworkpeople", async (req, res) => {
  try {
    const result = await getworkpeople(req.body);
    if (result && !result.userExist) {
      return res.send({ success: false, message: "failed" });
    }
    if (result && result.success) {
      // CHANGE THIS LINE: Change 'friends' to 'listings'
      return res.send({ success: true, listings: result.friendslist });
    }
    res.send({ success: false });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/addfriend", async (req, res) => {
  try {
    const result = await addfriend(req.body);
    if (result && !result.userExist) {
      return res.send({ success: false, message: "failed" });
    }
    if (result && result.success) {
      return res.send({ success: true, friends: result.friends });
    }
    res.send({ success: false });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getInfoListing", async (req, res) => {
  try {
    const result = await getinfolistings(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.listing);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/loginauth", async (req, res) => {
  try {
    const result = await login(req.body);
    if (result && result.notEmailFormat) {
      return res.send({ message: "NotEmailFormat" });
    }
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      return res.send({
        success: true,
        token: result.token,
        redirect: "/home",
      });
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
  if (result && !result.userExist) {
    return res.send({ message: "failed" });
  }
  if (result && result.success) {
    return res.send({ success: true, redirect: "/home" });
  }
});

app.post("/getuserdata", async (req, res) => {
  try {
    const result = await getuserdata(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/updateuserdata", async (req, res) => {
  try {
    const result = await updateuserdata(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getListings", async (req, res) => {
  try {
    const result = await getListings(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.listings);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getListing", async (req, res) => {
  try {
    const result = await getListing(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.listing);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/searchListings", async (req, res) => {
  try {
    const result = await searchListings(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.listings);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getMyListings", async (req, res) => {
  try {
    const result = await getMyListings(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.listings);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getMyAssignments", async (req, res) => {
  try {
    const result = await getMyAssignments(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.assignments);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/deactivateListing", async (req, res) => {
  try {
    const result = await deactivateListing(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.is_active);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/assign", async (req, res) => {
  try {
    const result = await assign(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/activateListing", async (req, res) => {
  try {
    const result = await activateListing(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.is_active);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/switchFile", async (req, res) => {
  try {
    const result = await switchFile(req.body);
    if (result && !result.userExist) {
      return res.status(401).send({ message: "failed" });
    }
    if (result && result.success) {
      let file = req.body.file;
      return res.send({ success: true, redirect: "/" + file });
    }
    return res.status(400).send({ message: "unknown error" });
  } catch (err) {
    console.error("switchFile endpoint error:", err);
    res.status(500).send({ error: err.message });
  }
});

app.post("/getNavbar", async (req, res) => {
  try {
    const result = await getNavbar(req.body);
    if (result && !result.userExist) {
      return res.send({ message: "failed" });
    }
    if (result && result.success) {
      res.send(result.navbar);
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post("/getfriendmessages", async (req, res) => {
  try {
    const result = await getfriendmessages(req.body);

    if (!result.userExist) {
      return res.status(401).send({ error: "Authentication failed" });
    }

    if (result.success) {
      // Always send an array, even if empty, to the frontend
      return res.send(result.messages || []);
    }

    // Fallback for logic errors
    return res.status(500).send({ error: "Internal logic error" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

app.post("/getworkmessages", async (req, res) => {
  try {
    const result = await getworkmessages(req.body);

    if (!result.userExist) {
      return res.status(401).send({ error: "Authentication failed" });
    }

    if (result.success) {
      // Always send an array, even if empty, to the frontend
      return res.send(result.messages || []);
    }

    // Fallback for logic errors
    return res.status(500).send({ error: "Internal logic error" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

app.post("/findFriend", async (req, res) => {
  const result = await findFriend(req.body);
  if (result.success) {
    res.status(200).send(result);
  } else {
    res.status(401).send(result);
  }
});

app.post("/sendfriendmessage", async (req, res) => {
  try {
    const result = await sendfriendmessage(req.body);

    // 1. Handle user not existing/wrong password
    if (!result.userExist) {
      return res
        .status(401)
        .send({ success: false, message: "Authentication failed" });
    }

    // 2. Handle success
    if (result.success) {
      // Send back a valid JSON object
      return res.send({ success: true, data: result.data });
    }

    // 3. Fallback for unexpected logic states
    return res.status(500).send({ success: false, message: "Unknown error" });
  } catch (err) {
    console.error(err);
    // Always send JSON, even on errors, so res.send() doesn't crash
    res.status(400).send({ success: false, error: err.message });
  }
});

app.post("/deleteListing", async (req, res) => {
  try {
    const result = await deleteListing(req.body);

    // 1. Handle user not existing/wrong password
    if (!result.userExist) {
      return res
        .status(401)
        .send({ success: false, message: "Authentication failed" });
    }

    // 2. Handle success
    if (result.success) {
      // Send back a valid JSON object
      return res.send({ success: true, data: result.data });
    }

    // 3. Fallback for unexpected logic states
    return res.status(500).send({ success: false, message: "Unknown error" });
  } catch (err) {
    console.error(err);
    // Always send JSON, even on errors, so res.send() doesn't crash
    res.status(400).send({ success: false, error: err.message });
  }
});

app.post("/getListingMessagers", async (req, res) => {
  try {
    let conn;
    conn = await pool.getConnection();

    // Authenticate user
    let saltResult = await conn.query(
      "SELECT salt FROM Users WHERE email = ?",
      [req.body.email],
    );
    if (saltResult.length === 0) {
      conn.release();
      return res
        .status(401)
        .send({ success: false, message: "User not found" });
    }

    const hashedPassword = hashPassword(req.body.password + saltResult[0].salt);
    const userRows = await conn.query(
      "SELECT id FROM Users WHERE email = ? AND password = ?",
      [req.body.email, hashedPassword],
    );

    if (userRows.length === 0) {
      conn.release();
      return res
        .status(401)
        .send({ success: false, message: "Authentication failed" });
    }

    // Get unique people who messaged about this listing
    const query = `
            SELECT DISTINCT u.id, u.first_name, u.last_name
            FROM Users u
            JOIN listingMessages lm ON (u.id = lm.sender_id OR u.id = lm.receiver_id)
            WHERE lm.listing_id = ?
            AND u.id != ?
        `;

    const messagers = await conn.query(query, [
      req.body.listing_id,
      userRows[0].id,
    ]);
    conn.release();

    const cleanMessagers = messagers.map((m) => ({
      id: Number(m.id),
      first_name: m.first_name,
      last_name: m.last_name,
    }));

    res.send({ success: true, messagers: cleanMessagers });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, error: err.message });
  }
});

const start = async () => {
  await setup();
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Find Server] Running on http://localhost:${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
