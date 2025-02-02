const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const User = require('../models/Users');
const auth = require('../middleware/auth');

const router = express.Router();

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// Endpoint pentru înregistrare utilizator
router.post('/signup', async (req, res) => {
  const { error } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(409).json({ message: 'Email in use' });

  const user = new User({ email, password });
  await user.save();
  res.status(201).json({
    user: {
      email: user.email,
      subscription: user.subscription,
    },
  });
});

// Endpoint pentru login utilizator
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Email or password is wrong' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Email or password is wrong' });

  const token = user.generateAuthToken();
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

module.exports = router;
