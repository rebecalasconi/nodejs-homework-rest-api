require('dotenv').config();

const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const usersRouter = require('./routes/users');
const path = require('path');

const app = express();
app.use('/avatars', express.static(path.join(__dirname, 'public', 'avatars')));

// Middleware
app.use(logger('dev'));
app.use(cors());
app.use(express.json());

// Rute pentru utilizatori
app.use('/api/users', usersRouter);

// Conectare la MongoDB
const DB_URI = process.env.DB_URI;
mongoose.connection.once('open', () => {
  console.log('MongoDB connection established');
});

// Conectare la MongoDB
mongoose.connect(DB_URI)
  .then(() => {
    console.log('Database connection successful');
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  });
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;
