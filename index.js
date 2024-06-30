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

// Registro de usuario
app.post('/api/users', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `INSERT INTO Users (username, email, password) VALUES (?, ?, ?)`;
        connection.query(query, [username, email, hashedPassword], (error, results) => {
            if (error) {
                console.error('Error inserting user:', error);
                return res.status(500).json({ error: 'Error inserting user' });
            }
            res.status(201).json({ id: results.insertId, username, email });
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        return res.status(500).json({ error: 'Error hashing password' });
    }
});

// Inicio de sesión
app.post('/api/users/login', async (req, res) => {
    const { username, password } = req.body;

    try {
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
                return res.status(401).json({ error: 'Incorrect password' });
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ error: 'Error during login' });
    }
});

// Solicitud de restablecimiento de contraseña
app.post('/api/reset-password', (req, res) => {
    const { email } = req.body;
    const resetCode = Math.floor(100000 + Math.random() * 900000); // Genera un código numérico de 6 dígitos

    const queryUpdate = 'UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
    const valuesUpdate = [resetCode, Date.now() + 300000, email]; // Expira en 5 minutos

    connection.query(queryUpdate, valuesUpdate, (error, results) => {
        if (error) {
            console.error('Error updating user with reset code:', error);
            return res.status(500).json({ error: 'Error updating user with reset code' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'No user found with that email address' });
        }

        const mailOptions = {
            to: email,
            from: 'kusitour.app@gmail.com',
            subject: 'Restablecer contraseña en Kusitour',
            text: `Ha solicitado un restablecimiento de contraseña en la aplicación KUSITOUR. Utilice el siguiente código: ${resetCode}`
        };

        transporter.sendMail(mailOptions, (mailError, info) => {
            if (mailError) {
                console.error('Error sending mail:', mailError);
                return res.status(500).json({ error: 'Error sending reset email' });
            }

            // Realiza una nueva consulta para obtener los datos actualizados
            const querySelect = 'SELECT resetPasswordToken, resetPasswordExpires FROM Users WHERE email = ?';
            connection.query(querySelect, [email], (selectError, selectResults) => {
                if (selectError) {
                    console.error('Error fetching updated user data:', selectError);
                    return res.status(500).json({ error: 'Error fetching updated user data' });
                }

                if (selectResults.length === 0) {
                    return res.status(404).json({ error: 'User not found after update' });
                }

                const userData = selectResults[0];
                res.status(200).json({
                    message: 'Reset email sent successfully',
                    code: resetCode,
                    token: userData.resetPasswordToken,
                    expires: userData.resetPasswordExpires
                });
            });
        });
    });
});




// Verificación de código de restablecimiento de contraseña
// Verificación de código de restablecimiento de contraseña
app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;  // 'code' debería ser un número ya

    const query = 'SELECT * FROM Users WHERE email = ? AND resetPasswordToken = ? AND resetPasswordExpires > ?';
    const values = [email, code, Date.now()];  // 'code' es usado directamente como número

    connection.query(query, values, (error, results) => {
        if (error) {
            console.error('Error verifying reset code:', error);
            return res.status(500).json({ error: 'Database query error during code verification' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Incorrect code or code expired' });
        }

        // Código correcto
        res.status(200).json({ message: 'Code verified successfully' });
    });
});




app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
