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
        user: 'kusitour.app@gmail.com',
        pass: 'mrdb rhjj qian qhma'
    }
});

// Registro de usuario
app.post('/api/users', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Verificar si el nombre de usuario ya existe en la base de datos
        const checkUsernameQuery = `SELECT * FROM Users WHERE username = ?`;
        connection.query(checkUsernameQuery, [username], async (usernameError, usernameResults) => {
            if (usernameError) {
                console.error('Error checking username:', usernameError);
                return res.status(500).json({ error: 'Error checking username' });
            }

            if (usernameResults.length > 0) {
                // El nombre de usuario ya está en uso
                return res.status(400).json({ error: 'Este nombre de usuario ya está en uso' });
            } else {
                // Verificar si el correo ya existe en la base de datos
                const checkEmailQuery = `SELECT * FROM Users WHERE email = ?`;
                connection.query(checkEmailQuery, [email], async (emailError, emailResults) => {
                    if (emailError) {
                        console.error('Error checking email:', emailError);
                        return res.status(500).json({ error: 'Error checking email' });
                    }

                    if (emailResults.length > 0) {
                        // El correo ya está en uso
                        return res.status(400).json({ error: 'Este correo ya está en uso' });
                    } else {
                        // El nombre de usuario y el correo no están en uso, proceder con la inserción del nuevo usuario
                        const hashedPassword = await bcrypt.hash(password, 10);
                        const insertUserQuery = `INSERT INTO Users (username, email, password) VALUES (?, ?, ?)`;
                        connection.query(insertUserQuery, [username, email, hashedPassword], (insertError, insertResults) => {
                            if (insertError) {
                                console.error('Error inserting user:', insertError);
                                return res.status(500).json({ error: 'Error inserting user' });
                            }
                            res.status(201).json({ id: insertResults.insertId, username, email });
                        });
                    }
                });
            }
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
    const resetCode = Math.floor(100000 + Math.random() * 900000); 

    const queryUpdate = 'UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
    const valuesUpdate = [resetCode, Date.now() + 300000, email]; 

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
app.post('/api/verify-code', (req, res) => {
    const { code } = req.body;  // 'code' debería ser un número ya

    const query = 'SELECT * FROM Users WHERE resetPasswordToken = ?';
    const values = [code, Date.now()];  // 'code' es usado directamente como número

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

// Cambio de contraseña
app.post('/api/change-password', async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const query = 'UPDATE Users SET password = ? WHERE email = ?';
        connection.query(query, [hashedPassword, email], (error, results) => {
            if (error) {
                console.error('Error updating password:', error);
                return res.status(500).json({ error: 'Error updating password' });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'No user found with that email address' });
            }

            res.status(200).json({ message: 'Password changed successfully' });
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        return res.status(500).json({ error: 'Error hashing password' });
    }
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
