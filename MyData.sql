DROP TABLE IF EXISTS Listings;
DROP TABLE IF EXISTS Users;

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    password VARCHAR(255),
    salt BIGINT UNSIGNED,
    location VARCHAR(255),
    age TINYINT UNSIGNED
);

CREATE TABLE Listings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,  -- This links to Users.id
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- This ensures a listing MUST belong to a real user
    CONSTRAINT fk_user 
    FOREIGN KEY (user_id) 
    REFERENCES Users(id) 
    ON DELETE CASCADE
);