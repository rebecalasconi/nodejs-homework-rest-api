const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const User = require("../models/Users");
require('dotenv').config();

const { JWT_SECRET } = process.env;

const auth = async (req, _, next) => {
  try {
    const { authorization = "" } = req.headers;
    const [bearer, token] = authorization.split(" ");
    console.log('JWT_SECRET:', process.env.JWT_SECRET);

    if (bearer !== "Bearer" || !token) {
      throw createError(401, "Not authorized");
    }

    const { id } = jwt.verify(token, JWT_SECRET);
    console.log('User ID extracted from token:', id);

    if (!id || typeof id !== 'string') {
      throw createError(400, "Invalid token ID");
    }

    console.log('User ID:', id);

    let user;
    try {
      // Verificăm dacă User este corect definit
      console.log('User model:', User);
      
      user = await User.findOne({ _id: id });

      if (!user) {
        console.log('User not found for ID:', id);
        throw createError(404, "User not found");
      }
    } catch (err) {
      console.error('Error when fetching user by ID:', err);
      throw createError(500, "Server error while fetching user");
    }

    console.log('User found:', user);

    if (String(user._id) !== id) {
      console.log('ID mismatch. User ID in DB:', user._id, 'ID from token:', id);
      throw createError(401, "Not authorized");
    }

    if (user.token !== token) {
      console.log('Token mismatch. Token in DB:', user.token, 'Token from request:', token);
      throw createError(401, "Not authorized");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error in auth middleware:', error);
    if (!error.status) {
      error.status = 401;
    }
    next(error);
  }
};

module.exports = auth;
