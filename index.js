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
    user: 'kusitour.app@gmail.com',
    pass: 'wehk lxnl zmas psut'
  }
});

// User registration
app.post('/api/users', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO Users (username, email, password) VALUES (?, ?, ?);`;
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
  const token = crypto.randomBytes(6).toString('hex').substring(0, 6); // Genera un código de 6 dígitos

  const query = 'UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
  const values = [token, Date.now() + 3600000, email]; // 1 hora

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
      from: 'kusitour.app@gmail.com',
      subject: 'Restablecimiento de Contraseña',
      text: `Has recibido este correo porque tú (u otra persona) ha solicitado el restablecimiento de la contraseña para tu cuenta.\n\n
             Tu código de verificación es: ${token}\n\n
             Si no solicitaste esto, por favor ignora este correo y tu contraseña permanecerá sin cambios.\n`
    };

    transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
        console.error('Error sending reset email:', error);
        res.status(500).json({ error: 'Error sending reset email' });
        return;
      }
      console.log('Reset email sent successfully:', response);
      res.status(200).json({ message: 'Correo de restablecimiento enviado exitosamente' });
    });
  });
});

// Verify code
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;

  const query = 'SELECT * FROM Users WHERE email = ? AND resetPasswordToken = ? AND resetPasswordExpires > ?';
  connection.query(query, [email, code, Date.now()], (error, results) => {
    if (error) {
      console.error('Error verifying code:', error);
      res.status(500).json({ error: 'Error verifying code' });
      return;
    }

    if (results.length === 0) {
      res.status(400).json({ error: 'Invalid or expired code' });
      return;
    }

    res.status(200).json({ message: 'Code verified successfully' });
  });
});

// Reset password
app.post('/api/reset-password/:email', async (req, res) => {
  const { password } = req.body;
  const email = req.params.email;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'UPDATE Users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?';
    connection.query(query, [hashedPassword, email], (error, results) => {
      if (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Error updating password' });
        return;
      }
      res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Error hashing password' });
  }
});

app.listen(port, () => {
  console.log(`HTTP Server running on port ${port}`);
});