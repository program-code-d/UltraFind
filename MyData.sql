--DROP TABLE IF EXISTS Listings;
--DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
        id INT AUTO_INCREMENT PRIMARY KEY UNSIGNED,
        email VARCHAR(255) NOT NULL UNIQUE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        password VARCHAR(255),
        salt BIGINT UNSIGNED,
        location VARCHAR(255),
        age TINYINT UNSIGNED
    );

CREATE TABLE Listings (
        id INT AUTO_INCREMENT PRIMARY KEY UNSIGNED,
        user_id INT NOT NULL, -- This links to Users.id
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- This ensures a listing MUST belong to a real user
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES Users (id) ON DELETE CASCADE
    );

CREATE TABLE Friends (
        id INT AUTO_INCREMENT PRIMARY KEY UNSIGNED,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )

CREATE TABLE Messages (
        id INT AUTO_INCREMENT PRIMARY KEY UNSIGNED,
        sender_id INT NOT NULL, -- The person sending
        receiver_id INT NOT NULL, -- The person receiving
        listing_id INT NOT NULL UNSIGNED, -- The item being discussed
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- Link to the sender
        CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES Users (id) ON DELETE CASCADE,
        -- Link to the receiver
        CONSTRAINT fk_receiver FOREIGN KEY (receiver_id) REFERENCES Users (id) ON DELETE CASCADE,
        -- Link to the listing
        CONSTRAINT fk_listing FOREIGN KEY (listing_id) REFERENCES Listings (id) ON DELETE CASCADE
    );