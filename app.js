require('dotenv').config(); // Încarcă variabilele din fișierul .env

const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const usersRouter = require('./routes/users');

const app = express();

// Middleware
app.use(logger('dev'));
app.use(cors());
app.use(express.json());

// Rute pentru utilizatori
app.use('/api/users', usersRouter);

const DB_URI = process.env.DB_URI; // Folosește URL-ul din variabila de mediu

mongoose.connect(DB_URI)
  .then(() => {
    console.log('Database connection successful');
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;