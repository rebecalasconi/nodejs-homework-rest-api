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
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
console.log(process.env.SENDGRID_API_KEY);  

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
// router.post('/signup', async (req, res) => {
//   const { error } = userSchema.validate(req.body);
//   if (error) return res.status(400).json({ message: error.details[0].message });

//   const { email, password } = req.body;
//   const existingUser = await User.findOne({ email });
//   if (existingUser) return res.status(409).json({ message: 'Email in use' });

//   const user = new User({ email, password });

//   // Generăm avatar cu Gravatar
//   const avatarURL = gravatar.url(user.email, { s: '250', r: 'x', d: 'identicon' });
//   user.avatarURL = avatarURL;

//   try {
//     await user.save();
//     const token = user.generateAuthToken();
//     user.token = token; 
//     await user.save();

//     res.status(201).json({
//       user: {
//         email: user.email,
//         subscription: user.subscription,
//         avatarURL: user.avatarURL,
//       },
//       token,
//     });
//   } catch (error) {
//     return res.status(500).json({ message: 'Error saving user with token', error });
//   }
// });
const { v4: uuidv4 } = require('uuid'); // Importăm uuid pentru a genera un token aleator

router.post('/signup', async (req, res) => {
  const { error } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(409).json({ message: 'Email in use' });

  const verificationToken = uuidv4(); // Generăm un token unic de verificare pentru utilizator

  const user = new User({
    email,
    password,
    verificationToken, // Setăm token-ul de verificare
  });

  // Generăm avatar cu Gravatar
  const avatarURL = gravatar.url(user.email, { s: '250', r: 'x', d: 'identicon' });
  user.avatarURL = avatarURL;

  try {
    await user.save();
    const token = user.generateAuthToken();
    user.token = token; 
    await user.save();

    // Trimite e-mail de verificare
    const msg = {
      from: 'rebecavoicilas@yahoo.com', // Asigură-te că folosești o adresă validă
      to: user.email,
      subject: 'Please verify your email address',
      text: `To verify your email address, click on the link below:\n\nhttp://localhost:3000/users/verify/${verificationToken}`,
      html: `<p>To verify your email address, click on the link below:</p><a href="http://localhost:3000/users/verify/${verificationToken}">Verify Email</a>`,
    };

  
    sgMail
    .send(msg)
    .then(() => {
      console.log('Email sent');
    })
    .catch((error) => {
      console.error('Error sending email:', error.response ? error.response.body : error);
    });
  

    res.status(201).json({
      user: {
        email: user.email,
        subscription: user.subscription,
        avatarURL: user.avatarURL,
      },
      token,
      verificationToken: user.verificationToken,
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

    // Verifică dacă utilizatorul este verificat
  if (!user.verify) {
    return res.status(400).json({ message: 'Email is not verified' });
  }

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

router.get('/verify/:verificationToken', async (req, res) => {
  const { verificationToken } = req.params; // Extragem tokenul de verificare din URL
  console.log('Verification Token:', verificationToken);

  // Căutăm utilizatorul în baza de date care are acest token de verificare
  const user = await User.findOne({ verificationToken }); 

  if (!user) {
    return res.status(404).json({ message: 'User not found' }); // Dacă nu găsim utilizatorul cu tokenul respectiv
  }

  if (user.verify) {
    return res.status(400).json({ message: 'Email is already verified' }); // Dacă utilizatorul a fost deja verificat
  }

  // Dacă utilizatorul a fost găsit și nu a fost încă verificat
  user.verify = true; // Setăm câmpul `verify` la `true` pentru a indica faptul că emailul a fost verificat
  user.verificationToken = null; // Ștergem tokenul de verificare, deoarece a fost utilizat
  await user.save(); // Salvăm modificările în baza de date
  console.log('User after verification:', user);


  res.status(200).json({ message: 'Verification successful' }); // Răspuns de succes
});


// Endpoint pentru trimiterea unui e-mail de verificare repetat
router.post('/verify', async (req, res) => {
  const { email } = req.body; // Extragem email-ul din request body
  

  if (!email) {
    return res.status(400).json({ message: 'missing required field email' }); // Verificăm dacă există câmpul email
  }

  const user = await User.findOne({ email }); // Căutăm utilizatorul cu acest email
  console.log('User found:', user);


  if (!user) {
    return res.status(404).json({ message: 'User not found' }); // Dacă utilizatorul nu există
  }

  if (user.verify) {
    return res.status(400).json({ message: 'Verification has already been passed' }); // Dacă utilizatorul este deja verificat
  }

  // Trimitem e-mail de verificare
  const msg = {
    to: user.email,
    from: 'rebecavoicilas@yahoo.com', // Adresa de e-mail de pe care se trimit mesajele
    subject: 'Please verify your email address',
    text: `To verify your email address, click on the link below:\n\nhttp://localhost:3000/users/verify/${user.verificationToken}`,
    html: `<p>To verify your email address, click on the link below:</p><a href="http://localhost:3000/users/verify/${user.verificationToken}">Verify Email</a>`,
  };

  try {
    await sgMail.send(msg); // Trimiterea efectivă a e-mailului
    res.status(200).json({ message: 'Verification email sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending verification email' });
  }
});

module.exports = router;
