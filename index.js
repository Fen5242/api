const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const connection = mysql.createConnection({
  host: 'kusitour.cshzgid8yldu.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'root',
  password: 'fendo365S',
  database: 'kusitour'
});

connection.connect(error => {
  if (error) {
    console.error('Error connecting to the database:', error);
    return;
  }
  console.log('Connected to the database successfully');
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'sanchezfsb3@gmail.com',
    pass: 'ameb sqso anmt tatr'
  }
});

app.post('/api/users', async (req, res) => {
  const { username, email, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)';
    connection.query(query, [username, email, hashedPassword], (error, results) => {
      if (error) {
        console.error('Error inserting user:', error);
        return res.status(500).json({ error: 'Error inserting user' });
      }
      res.status(201).json({ id: results.insertId, username, email });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Error hashing password' });
  }
});

app.post('/api/users/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  const query = 'SELECT * FROM Users WHERE username = ?';
  connection.query(query, [username], async (error, results) => {
    if (error) {
      console.error('Error finding user:', error);
      return res.status(500).json({ error: 'Error finding user' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    res.status(200).json({ message: `Welcome, ${user.username}`, user });
  });
});

app.post('/api/reset-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const query = 'SELECT * FROM Users WHERE email = ?';
  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error('Error finding user:', error);
      return res.status(500).json({ error: 'Database query error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'No user found with that email address' });
    }
    const token = crypto.randomBytes(20).toString('hex');
    const updateQuery = 'UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
    connection.query(updateQuery, [token, Date.now() + 3600000, email], (updateError, updateResults) => {
      if (updateError) {
        console.error('Error updating user with reset token:', updateError);
        return res.status(500).json({ error: 'Error updating user with reset token' });
      }
      const mailOptions = {
        to: email,
        from: 'kusitour.app@gmail.com',
        subject: 'Password Reset',
        text: `You have requested a password reset. Please use the following token: ${token}`
      };
      transporter.sendMail(mailOptions, (mailError, info) => {
        if (mailError) {
          console.error('Error sending mail:', mailError);
          return res.status(500).json({ error: 'Error sending reset email' });
        }
        res.status(200).json({ message: 'Reset email sent successfully', token });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
