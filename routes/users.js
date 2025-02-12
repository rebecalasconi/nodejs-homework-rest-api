const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp'); // Importăm Sharp
const fs = require('fs');
const path = require('path');
const gravatar = require('gravatar');
const User = require('../models/Users');
const auth = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// Configurare pentru stocare pe disc
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Endpoint pentru înregistrare utilizator
router.post('/signup', async (req, res) => {
  const { error } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(409).json({ message: 'Email in use' });

  const user = new User({ email, password });

  // Generăm avatar cu Gravatar
  const avatarURL = gravatar.url(user.email, { s: '250', r: 'x', d: 'identicon' });
  user.avatarURL = avatarURL;

  try {
    await user.save();
    const token = user.generateAuthToken();
    user.token = token; 
    await user.save();

    res.status(201).json({
      user: {
        email: user.email,
        subscription: user.subscription,
        avatarURL: user.avatarURL,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error saving user with token', error });
  }
});

// Endpoint pentru login utilizator
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const { error } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Email or password is wrong' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Email or password is wrong' });

  const token = user.generateAuthToken();
  user.token = token;

  try {
    await user.save();
  } catch (error) {
    return res.status(500).json({ message: 'Error saving user with token', error });
  }

  res.status(200).json({
    token,
    user: {
      email: user.email,
      subscription: user.subscription,
    },
  });
});

// Endpoint pentru logout utilizator
router.get('/logout', auth, async (req, res) => {
  req.user.token = null;
  await req.user.save();
  res.status(204).send();
});

// Endpoint pentru obținerea datelor utilizatorului curent
router.get('/current', auth, (req, res) => {
  res.status(200).json({
    email: req.user.email,
    subscription: req.user.subscription,
  });
});

// Endpoint pentru actualizarea avatarului
router.patch('/avatars', auth, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.id; // ID-ul utilizatorului este disponibil în req.user datorită middleware-ului auth
    const user = await User.findById(userId); // Căutăm utilizatorul în baza de date

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calea fișierului temporar și calea finală
    const tempImagePath = path.join(__dirname, '..', 'tmp', req.file.filename);
    const avatarName = `${userId}-${Date.now()}.jpg`;
    const finalAvatarPath = path.join(__dirname, '..', 'public', 'avatars', avatarName);

    // Log pentru a verifica calea finală
    console.log('Temp Image Path:', tempImagePath);
    console.log('Final Avatar Path:', finalAvatarPath);

    // Verificăm dacă directorul 'avatars' există, dacă nu, îl creăm
    const avatarDir = path.dirname(finalAvatarPath);
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
      console.log('Created avatars directory:', avatarDir);  // Log pentru a confirma crearea directorului
    }

    // Folosim sharp pentru a redimensiona imaginea
    await sharp(tempImagePath)
      .resize(250, 250)
      .toFile(finalAvatarPath);  // Scriem fișierul procesat în folderul public/avatars

    // Actualizăm avatarURL-ul în baza de date
    user.avatarURL = `/avatars/${avatarName}`;
    await user.save(); // Salvăm utilizatorul cu noul avatar

    // Răspuns de succes cu URL-ul avatarului
    res.status(200).json({ avatarURL: user.avatarURL });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
    console.log('Request file:', req.file);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
  }
});

module.exports = router;
