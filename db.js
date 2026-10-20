const mysql = require('mysql2');
require('dotenv').config();

function dbSsl() {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') return undefined;
  const ca = String(process.env.DB_CA_CERT || '').replace(/\\n/g, '\n').trim();
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: dbSsl()
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
  } else {
    console.log('Connected to MySQL Database:', process.env.DB_NAME);
    connection.release();
  }
});

module.exports = pool.promise();