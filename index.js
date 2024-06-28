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
  console.log('Connected to the database');
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-email-password'
  }
});

// User registration
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

// User login
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

// Reset password request
app.post('/api/reset-password', (req, res) => {
  const { email } = req.body;
  const token = crypto.randomBytes(20).toString('hex');

  const query = 'UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
  const values = [token, Date.now() + 3600000, email]; // 1 hour

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error updating user with reset token:', error);
      res.status(500).json({ error: 'Error updating user with reset token' });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ error: 'No user found with that email address' });
      return;
    }

    const mailOptions = {
      to: email,
      from: 'your-email@gmail.com',
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
             Please click on the following link, or paste this into your browser to complete the process:\n\n
             http://localhost:3000/reset/${token}\n\n
             If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
        console.error('Error sending reset email:', error);
        res.status(500).json({ error: 'Error sending reset email' });
        return;
      }
      console.log('Reset email sent successfully:', response);
      res.status(200).json({ message: 'Reset email sent successfully' });
    });
  });
});

// Reset password
app.post('/api/reset/:token', async (req, res) => {
  const { password } = req.body;
  const token = req.params.token;

  const query = 'SELECT * FROM Users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?';
  connection.query(query, [token, Date.now()], async (error, results) => {
    if (error) {
      console.error('Error finding user with token:', error);
      res.status(500).json({ error: 'Error finding user with token' });
      return;
    }

    if (results.length === 0) {
      res.status(400).json({ error: 'Password reset token is invalid or has expired' });
      return;
    }

    const user = results[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    const updateQuery = 'UPDATE Users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?';
    connection.query(updateQuery, [hashedPassword, user.id], (updateError, updateResults) => {
      if (updateError) {
        console.error('Error updating password:', updateError);
        res.status(500).json({ error: 'Error updating password' });
        return;
      }
      console.log('Password updated successfully:', updateResults);
      res.status(200).json({ message: 'Password updated successfully' });
    });
  });
});

app.listen(port, () => {
  console.log(`HTTP Server running on port ${port}`);
});
