const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Conectar a MongoDB
mongoose.connect('mongodb://mongo:vPHqbXyYffkFVJLdVVsFKkqeSRRnptyi@monorail.proxy.rlwy.net:29424/your-database-name', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(error => console.error('Error connecting to MongoDB:', error));

// Definir el esquema y el modelo de Usuario
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

const User = mongoose.model('User', userSchema);

// Ruta para registrar nuevos usuarios
app.post('/api/users', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ id: newUser._id, username, email });
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ error: 'Error inserting user' });
  }
});

// Ruta para iniciar sesión
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.status(200).json({
        message: `Welcome, ${user.username}`,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } else {
      res.status(401).json({ error: 'Incorrect password' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Error during login' });
  }
});

// Inicia el servidor HTTP
app.listen(port, () => {
  console.log(`HTTP Server running on port ${port}`);
});
