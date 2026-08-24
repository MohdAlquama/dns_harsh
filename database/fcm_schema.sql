-- Existing application user table (created by models/authTable.js).
CREATE TABLE IF NOT EXISTS auth_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- One user may have many rows (one per browser/device). A device token belongs
-- to only one user at a time and is automatically removed when its user is deleted.
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(512) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fcm_tokens_token (token),
    KEY idx_fcm_tokens_user_id (user_id),
    CONSTRAINT fk_fcm_tokens_user FOREIGN KEY (user_id)
        REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
