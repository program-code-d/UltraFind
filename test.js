const fs = require('fs');

const BASE_URL = 'http://localhost:8080';
const IMAGE_PATH = './image.png';

async function runTests() {
    console.log("--- STARTING DATABASE SEEDING ---");

    // 1. CREATE 200 USERS
    const users = [];
    console.log("Creating 200 users...");
    for (let i = 1; i <= 200; i++) {
        const userData = {
            firstName: `User${i}`,
            lastName: `Test${i}`,
            email: `tester${i}@example.com`,
            password: `pass123_${i}`,
            age: 20 + (i % 30)
        };
        const res = await fetch(`${BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (res.ok) users.push(userData);
    }
    console.log(`Successfully created ${users.length} users.`);

    // 2. CREATE 50 LISTINGS (WITH Images)
    console.log("Creating 50 listings with image uploads...");
    const listingIds = [];
    if (!fs.existsSync(IMAGE_PATH)) {
        console.error("Error: image.png not found. Cannot upload images.");
    } else {
        for (let i = 0; i < 50; i++) {
            const user = users[i];
            
            // First: Upload the image
            const formData = new FormData();
            const fileBuffer = fs.readFileSync(IMAGE_PATH);
            const blob = new Blob([fileBuffer], { type: 'image/png' });
            formData.append('file', blob, 'image.png');

            const uploadRes = await fetch(`${BASE_URL}/upload-listing`, {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadRes.json();

            // Second: Create the listing
            const listRes = await fetch(`${BASE_URL}/createListing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    password: user.password,
                    name: `Amazing Item ${i}`,
                    description: `This is the description for item ${i}`,
                    pay: 50 + i,
                    location: "New York",
                    age: 18,
                    image_path: uploadData.path // Simulating the link
                })
            });
            // We need to find the ID. Since createListing redirects, 
            // we'll fetch the user's listings to get the latest ID.
            const myListsRes = await fetch(`${BASE_URL}/getMyListings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: user.password })
            });
            const myListings = await myListsRes.json();
            if (myListings.length > 0) listingIds.push(myListings[0].id);
        }
    }
    console.log(`Created 50 listings.`);

    // 3. CREATE 50 FRIENDSHIPS
    console.log("Creating 50 friendships...");
    for (let i = 0; i < 50; i++) {
        await fetch(`${BASE_URL}/addfriend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: users[i].email,
                password: users[i].password,
                selectedFriendId: i + 2 // Friend the next person
            })
        });
    }

    // 4. CREATE 50 LISTING MESSAGES
    console.log("Creating 50 listing messages...");
    for (let i = 0; i < 50; i++) {
        // User (i+1) messages the owner of listing (i)
        await fetch(`${BASE_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: users[i + 1].email,
                password: users[i + 1].password,
                listing_id: listingIds[i],
                message: `Is item ${i} still available?`
            })
        });
    }

    console.log("--- SEEDING COMPLETE ---");
    await runSecurityAudit(users[0]);
}

async function runSecurityAudit(adminUser) {
    console.log("\n" + "=".repeat(50));
    console.log(" CRITICAL SECURITY VULNERABILITY AUDIT ");
    console.log("=".repeat(50));

    // ATTACK 1: Path Traversal / File Overwrite
    // Your code uses data.filename directly. I can try to overwrite your server files.
    console.log("\n[TEST 1] Attempting Path Traversal via File Upload...");
    const exploitForm = new FormData();
    const exploitBlob = new Blob(["// Server Hacked"], { type: 'text/javascript' });
    exploitForm.append('file', exploitBlob, '../HACK_CONFIRMED.txt'); 

    const exploitRes = await fetch(`${BASE_URL}/upload-listing`, {
        method: 'POST',
        body: exploitForm
    });
    const exploitData = await exploitRes.json();
    console.log(`- Result: Server allowed file save to: ${exploitData.path}`);
    if (exploitData.path.includes('..')) {
        console.log("  [!] CRITICAL VULNERABILITY: Path Traversal confirmed. I can overwrite index.js or any file on your system.");
    }

    // ATTACK 2: Open Redirect
    console.log("\n[TEST 2] Testing /switchFile for Open Redirect...");
    const redirectRes = await fetch(`${BASE_URL}/switchFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: adminUser.email,
            password: adminUser.password,
            file: "https://google.com" 
        }),
        redirect: 'manual'
    });
    const location = redirectRes.headers.get('location');
    console.log(`- Result: Redirected to: ${location}`);
    if (location && location.includes('google.com')) {
        console.log("  [!] VULNERABILITY: Open Redirect found. Attackers can use your site to phish users.");
    }

    // ATTACK 3: SQL Data Harvesting
    console.log("\n[TEST 3] Testing /findFriend for Data Leaks...");
    const sqlRes = await fetch(`${BASE_URL}/findFriend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: adminUser.email,
            password: adminUser.password,
            friendSearch: "%" // Wildcard to fetch everyone
        })
    });
    const sqlData = await sqlRes.json();
    console.log(`- Result: Harvested ${sqlData.friends ? sqlData.friends.length : 0} full names and IDs from the database.`);

    console.log("\n--- FINAL SECURITY REPORT ---");
    console.log("1. FILE UPLOAD (Critical): You trust the 'filename' from the user. I can use '../' to escape the images folder and overwrite your backend source code. This allows for Remote Code Execution (RCE).");
    console.log("2. REDIRECTS (High): The /switchFile endpoint appends user input directly to the URL. An attacker can send users to malicious websites.");
    console.log("3. AUTHENTICATION (Medium): You transmit plaintext passwords in the body of every single request. If an attacker sniffs the network, they have total control of every account.");
    console.log("4. DATABASE (Low): While you used '?' (good), you didn't include a 'LIMIT' on searches. A user can search for '%' and crash your server by forcing it to return 1,000,000 rows.");
}

runTests().catch(err => console.error("Test failed:", err));