// backend/config/db.js
const serverlessMysql = require("serverless-mysql");

const db = serverlessMysql({
  config: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

console.log("serverless-mysql configured successfully.");

module.exports = db;
