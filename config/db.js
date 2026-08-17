import mysql from "mysql2/promise";

const db = mysql.createPool({
    host: "localhost",
    user: "harsh",
    password: "Harsh0003",
    database: "DNS",
});

try {
    const connection = await db.getConnection();
    console.log("✅ MySQL Connected Successfully");
    connection.release();
} catch (error) {
    console.log("❌ MySQL Connection Failed");
    console.log(error.message);
}



export default db;