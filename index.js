const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const connection = mysql.createConnection({
  host: 'kusitour.cshzgid8yldu.us-east-1.rds.amazonaws.com', // Reemplaza con tu endpoint de RDS
  port: 3306, // Asegúrate de que el puerto sea 3306
  user: 'root', // Reemplaza con tu nombre de usuario de RDS
  password: 'fendo365S', // Reemplaza con tu contraseña de RDS
  database: 'mydatabase' // Reemplaza con tu nombre de base de datos
});

connection.connect(error => {
  if (error) {
    console.error('Error connecting to the database:', error);
    return;
  }
  console.log('Connected to the database');
});

// Define routes for user registration and login
app.post('/api/users', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO Users (username, email, password)
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

app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const query = 'SELECT * FROM Users WHERE username = ?';
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

app.listen(port, () => {
  console.log(`HTTP Server running on port ${port}`);
});
