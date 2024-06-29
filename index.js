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
    pass: 'wehklxnlzmaspsut'  // Usar la contraseña de aplicación generada
  }
});

// Reset password request
app.post('/api/reset-password', (req, res) => {
  const { email } = req.body;
  const token = crypto.randomBytes(3).toString('hex').toUpperCase(); // Genera un código de 6 caracteres

  const query = 'UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
  const values = [token, Date.now() + 3600000, email]; // 1 hour

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error('Error updating user with reset token:', error);
      res.status(500).json({ error: 'Error updating user with reset token', details: error.message });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ error: 'No user found with that email address' });
      return;
    }

    const mailOptions = {
      to: email,
      from: 'kusitour.app@gmail.com',
      subject: 'Código de Restablecimiento de Contraseña',
      text: `Has recibido este correo porque tú (u otra persona) ha solicitado el restablecimiento de la contraseña para tu cuenta.\n\n
             Por favor usa el siguiente código para completar el proceso de restablecimiento de contraseña:\n\n
             Código: ${token}\n\n
             Si no solicitaste esto, por favor ignora este correo y tu contraseña permanecerá sin cambios.\n`
    };

    transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
        console.error('Error sending reset email:', error);
        res.status(500).json({ error: 'Error sending reset email', details: error.message });
        return;
      }
      console.log('Reset email sent successfully:', response);
      res.status(200).json({ message: 'Correo de restablecimiento enviado exitosamente' });
    });
  });
});

// Verificar código
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;

  const query = 'SELECT * FROM Users WHERE email = ? AND resetPasswordToken = ? AND resetPasswordExpires > ?';
  connection.query(query, [email, code, Date.now()], (error, results) => {
    if (error) {
      console.error('Error finding user with token:', error);
      res.status(500).json({ error: 'Error finding user with token', details: error.message });
      return;
    }

    if (results.length === 0) {
      res.status(400).json({ error: 'Código de restablecimiento inválido o expirado' });
      return;
    }

    res.status(200).json({ message: 'Código verificado correctamente' });
  });
});

// Cambiar contraseña
app.post('/api/change-password', async (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);
  const query = 'UPDATE Users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?';
  connection.query(query, [hashedPassword, email], (error, results) => {
    if (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Error updating password', details: error.message });
      return;
    }

    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  });
});

app.listen(port, () => {
  console.log(`HTTP Server running on port ${port}`);
});
