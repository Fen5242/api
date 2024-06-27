const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Configura la conexión con la base de datos
const connection = mysql.createConnection({
  host: process.env.MYSQLHOST || 'roundhouse.proxy.rlwy.net',
  port: process.env.MYSQLPORT || 42318,
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'CtXLxHbsElagTSwGPbOznIkstuaEiAEA',
  database: process.env.MYSQLDATABASE || 'railway'
});

// Conecta con la base de datos
connection.connect(error => {
  if (error) {
    console.error('Error connecting to the database:', error);
    return;
  }
  console.log('Connected to the database');
});

// Define una ruta para crear la tabla Users
app.get('/create-users-table', (req, res) => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS Users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    );
  `;

  connection.query(createTableQuery, (error, results) => {
    if (error) {
      console.error('Error creating Users table:', error);
      res.status(500).json({ error: 'Error creating Users table' });
      return;
    }
    res.status(200).json({ message: 'Users table created successfully', results });
  });
});

// Define una ruta para registrar usuarios
app.post('/api/users', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO \`Users\` (username, email, password)
      VALUES (?, ?, ?);
    `;
    connection.query(query, [username, email, hashedPassword], (error, results) => {
      if (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ error: 'Error inserting user' });
        return;
      }
      res.status(201).json({ id: results.insertId, username, email });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Error hashing password' });
  }
});

// Define una ruta para iniciar sesión
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const query = 'SELECT * FROM `Users` WHERE username = ?';
    connection.query(query, [username], async (error, results) => {
      if (error) {
        console.error('Error finding user:', error);
        res.status(500).json({ error: 'Error finding user' });
        return;
      }

      if (results.length === 0) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const user = results[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        res.status(200).json({
          message: `Welcome, ${user.username}`,
          user: {
            id: user.id,
            username: user.username,
            email: user.email
            // No es seguro devolver la contraseña, se recomienda omitir esto.
          }
        });
      } else {
        res.status(401).json({ error: 'Incorrect password' });
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Error during login' });
  }
});

// Inicia el servidor HTTP
app.listen(port, () => {
  console.log(`HTTP Server running on port ${port}`);
});