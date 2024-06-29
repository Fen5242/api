const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

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

// Register User
app.post('/api/users/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = `INSERT INTO Users (username, email, password) VALUES (?, ?, ?)`;

  connection.query(query, [username, email, hashedPassword], (error, results) => {
    if (error) {
      console.error('Error inserting user:', error);
      return res.status(500).json({ error: 'Error inserting user' });
    }
    res.status(201).json({ id: results.insertId, username, email });
  });
});

// User Login
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  const query = `SELECT * FROM Users WHERE email = ?`;

  connection.query(query, [email], async (error, results) => {
    if (error) {
      console.error('Error finding user:', error);
      return res.status(500).json({ error: 'Error finding user' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    res.status(200).json({ message: 'Login successful', user });
  });
});

// Reset Password Request
app.post('/api/reset-password', (req, res) => {
  const { email } = req.body;
  const query = 'SELECT * FROM Users WHERE email = ?';

  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ error: 'Error finding user' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'No user found with that email address' });
    }

    const user = results[0];
    const token = crypto.randomBytes(20).toString('hex');

    const updateQuery = 'UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
    connection.query(updateQuery, [token, Date.now() + 3600000, email], (updateError, updateResults) => {
      if (updateError) {
        console.error('Error updating user with reset token:', updateError);
        return res.status(500).json({ error: 'Error updating user with reset token' });
      }

      const mailOptions = {
        to: email,
        from: 'your-email@gmail.com',
        subject: 'Password Reset',
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.
               Please use the following token for resetting your password: ${token}`
      };

      transporter.sendMail(mailOptions, (mailError, info) => {
        if (mailError) {
          console.error('Error sending mail:', mailError);
          return res.status(500).json({ error: 'Error sending reset email' });
        }
        res.status(200).json({ message: 'Reset email sent successfully' });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
