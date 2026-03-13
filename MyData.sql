SET
    FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS listingMessages;

DROP TABLE IF EXISTS DirectMessages;

DROP TABLE IF EXISTS Friendships;

DROP TABLE IF EXISTS Listings;

DROP TABLE IF EXISTS Users;

DROP TABLE IF EXISTS Friends;

-- Adding your old table name just in case it's still there
SET
    FOREIGN_KEY_CHECKS = 1;

CREATE TABLE
    Users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        password VARCHAR(255),
        salt BIGINT UNSIGNED,
        location VARCHAR(255),
        age TINYINT UNSIGNED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    Listings (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        age TINYINT UNSIGNED,
        location TEXT,
        price DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES Users (id) ON DELETE CASCADE
    );

-- 1. This table ONLY handles the "Add Friend" connection
CREATE TABLE
    Friendships (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        friend_id INT UNSIGNED NOT NULL,
        status ENUM ('pending', 'accepted', 'blocked') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_friend_user FOREIGN KEY (user_id) REFERENCES Users (id) ON DELETE CASCADE,
        CONSTRAINT fk_friend_friend FOREIGN KEY (friend_id) REFERENCES Users (id) ON DELETE CASCADE,
        UNIQUE KEY unique_friendship (user_id, friend_id) -- Prevents duplicate friend rows
    );

-- 2. This table ONLY handles the actual text messages between friends
CREATE TABLE
    DirectMessages (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sender_id INT UNSIGNED NOT NULL,
        receiver_id INT UNSIGNED NOT NULL,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_dm_sender FOREIGN KEY (sender_id) REFERENCES Users (id) ON DELETE CASCADE,
        CONSTRAINT fk_dm_receiver FOREIGN KEY (receiver_id) REFERENCES Users (id) ON DELETE CASCADE
    );

CREATE TABLE
    listingMessages (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sender_id INT UNSIGNED NOT NULL,
        receiver_id INT UNSIGNED NOT NULL,
        listing_id INT UNSIGNED NOT NULL,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES Users (id) ON DELETE CASCADE,
        CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES Users (id) ON DELETE CASCADE,
        CONSTRAINT fk_msg_listing FOREIGN KEY (listing_id) REFERENCES Listings (id) ON DELETE CASCADE
    );