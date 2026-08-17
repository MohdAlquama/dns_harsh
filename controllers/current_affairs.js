import db from "../config/db.js";

export const current_affairs_sql_table  = function () {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS CURRENTAFFAIRE (
      id INT AUTO_INCREMENT PRIMARY KEY,
      CURRENT_AFFAIRS_NAME VARCHAR(200) NOT NULL UNIQUE,
      LONG_DESCRIPTION TEXT,
      SHORT_DESCRIPTION VARCHAR(500),
      IMG VARCHAR(255) NOT NULL,
      PRICE BOOLEAN DEFAULT 0,
      GST BOOLEAN DEFAULT 0,
      PLATFORM_CHARGE BOOLEAN DEFAULT 0,
      ADS BOOLEAN DEFAULT 0,
      OFFER BOOLEAN DEFAULT 0,
      NOTIFICATION BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;

  // Execute the table creation query
  db.query(createTableQuery, (queryErr, results) => {
    if (queryErr) {
      console.error("Error creating the table:", queryErr);
      return;
    }
    console.log("Table structure verified/created successfully.");
  });
};

export const current_affairs_mode_frsh=function(){}
export const current_affairs_mode_edit=function(){}
export const current_affairs_mode_delete=function(){}
export const current_affairs_mode_status_ads=function(){}
export const current_affairs_mode_status_notification=function(){}
export const current_affairs_mode_upload_pdf=function(){}
export const date_formating=function(){}
export const current_affairs_mode_offer=function(){}
export const current_affairs_mode_offer_apply=function(){}
export const current_affairs_price=function(){}
