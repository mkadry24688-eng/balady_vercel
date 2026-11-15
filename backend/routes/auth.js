const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const secret = process.env.JWT_SECRET;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      secret,
      { expiresIn: '8h' }
    );

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL === '1';

    res.cookie('token', token, {
      path: '/',
      maxAge: 8 * 3600 * 1000,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      httpOnly: true
    });

    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ success: true });
});

module.exports = router;
module.exports.router = router;