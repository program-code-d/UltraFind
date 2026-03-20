/**
 * test.js
 * Run this with: node test.js
 * No dependencies required (uses native Node.js fetch)
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const IMAGE_FILE = './image.png';

async function runTest() {
    console.log("--- STARTING DATABASE SEEDING ---");

    // 1. Create 200 Users
    const users = [];
    for (let i = 1; i <= 200; i++) {
        const user = {
            firstName: `User${i}`,
            lastName: `Test${i}`,
            email: `user${i}@example.com`,
            password: `password${i}`,
            age: 20 + (i % 30)
        };
        
        const res = await fetch(`${BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        
        if (res.ok) {
            users.push(user);
            if (i % 50 === 0) console.log(`Created ${i}/200 users...`);
        }
    }

    const mainUser = users[0];
    const targetUser = users[1];

    // 2. Create Friendships
    console.log("Creating friendships...");
    for (let i = 1; i <= 5; i++) {
        await fetch(`${BASE_URL}/addfriend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: mainUser.email,
                password: mainUser.password,
                selectedFriendId: i + 1
            })
        });
    }

    // 3. Create Listing with Image Upload
    console.log("Creating listing with image...");
    if (fs.existsSync(IMAGE_FILE)) {
        // Simulate Multipart Upload
        const formData = new FormData();
        const blob = new Blob([fs.readFileSync(IMAGE_FILE)], { type: 'image/png' });
        formData.append('file', blob, 'image.png');

        const uploadRes = await fetch(`${BASE_URL}/upload-listing`, {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
            await fetch(`${BASE_URL}/createListing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: mainUser.email,
                    password: mainUser.password,
                    name: "Test Item",
                    description: "Seeded listing",
                    pay: 100,
                    location: "New York",
                    age: 1
                })
            });
        }
    }

    // 4. Create Messages
    console.log("Sending direct messages...");
    await fetch(`${BASE_URL}/sendfriendmessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: mainUser.email,
            password: mainUser.password,
            friend_id: 2,
            message: "Hey! How are you?"
        })
    });

    console.log("--- SEEDING COMPLETE ---");
    console.log("\n--- STARTING VULNERABILITY AUDIT ---");

    /**
     * VULNERABILITY 1: OPEN REDIRECT / PATH TRAVERSAL
     * Endpoint: /switchFile
     * Danger: The app blindly appends user input to a redirect.
     */
    console.log("\n[TEST 1] Testing /switchFile for Open Redirect...");
    const redirectTest = await fetch(`${BASE_URL}/switchFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: mainUser.email,
            password: mainUser.password,
            file: "https://google.com" 
        }),
        redirect: 'manual'
    });
    console.log(`- Result: Redirects to: ${redirectTest.headers.get('location')}`);

    /**
     * VULNERABILITY 2: UNRESTRICTED FILE UPLOAD / PATH TRAVERSAL
     * Endpoint: /upload-listing
     * Danger: The backend uses 'data.filename' directly in a path join.
     * This allows an attacker to overwrite your backend code (e.g., index.js).
     */
    console.log("\n[TEST 2] Testing /upload-listing for Path Traversal (RCE Potential)...");
    const maliciousForm = new FormData();
    const maliciousBlob = new Blob(["console.log('HACKED')"], { type: 'text/javascript' });
    // Attempting to go up directories and overwrite a file
    maliciousForm.append('file', maliciousBlob, '../../hacked.js'); 

    const maliciousRes = await fetch(`${BASE_URL}/upload-listing`, {
        method: 'POST',
        body: maliciousForm
    });
    const maliciousData = await maliciousRes.json();
    console.log(`- Result: Server saved file to: ${maliciousData.path}`);
    if (maliciousData.path.includes('..')) {
        console.log("  CRITICAL: Server is vulnerable to Directory Traversal via File Upload!");
    }

    /**
     * VULNERABILITY 3: SENSITIVE INFORMATION DISCLOSURE
     * Danger: No session management. Passwords sent in every body.
     */
    console.log("\n[TEST 3] Audit: Credential Handling...");
    console.log("- Warning: Every API call requires plaintext email/password in the JSON body.");
    console.log("- Risk: If an attacker intercepts one request, they have the user's permanent credentials.");

    /**
     * VULNERABILITY 4: SQL INJECTION PROBE
     * Note: You used parameterized queries (?) which is GOOD. It prevents most SQLi.
     * However, the 'LIKE' queries can still be abused to guess data.
     */
    console.log("\n[TEST 4] Testing /findFriend for Data Leakage...");
    const sqlProbe = await fetch(`${BASE_URL}/findFriend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: mainUser.email,
            password: mainUser.password,
            friendSearch: "%" // Trying to dump all users in the system
        })
    });
    const sqlData = await sqlProbe.json();
    console.log(`- Result: Discovered ${sqlData.friends ? sqlData.friends.length : 0} users via wildcard.`);

    console.log("\n--- AUDIT COMPLETE ---");
}

runTest().catch(err => console.error("Test script error:", err));