const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Definirea schema utilizatorului
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  subscription: {
    type: String,
    enum: ['starter', 'pro', 'business'],
    default: 'starter',
  },
  token: {
    type: String,
    default: null,
  },
});

// Criptarea parolei înainte de a salva utilizatorul
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Metodă pentru generarea token-ului
userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ id: this._id }, 'secret_key', { expiresIn: '1h' });
  this.token = token;
  return token;
};

// Crearea modelului User
const User = mongoose.model('User', userSchema);

module.exports = User;
