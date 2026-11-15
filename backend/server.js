require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');


const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');

const authRoutes = require('./routes/auth');
const certRoutes = require('./routes/certificates');


const app = express();
const allowedOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware to protect admin page routes with HTTP 302 redirect (works even with JS disabled)
const protectedPageRoutes = [
  '/dashboard',
  '/add-certificate',
  '/edit-certificate',
  '/certificate',
  '/certificates'
];

function pageAuthMiddleware(req, res, next) {
  const url = req.path;
  const isProtected = protectedPageRoutes.some(p => url === p || url.startsWith(p + '/'));

  if (isProtected) {
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/(?:^|;\s*)token=([^;]+)/);
    const token = match ? match[1] : null;

    if (!token) {
      return res.redirect('/');
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (err) {
      return res.redirect('/');
    }
  }

  next();
}

app.use(pageAuthMiddleware);

app.use('/api', authRoutes);
app.use('/api', certRoutes);

// Serve frontend build if present
const frontendBuildPath = path.join(__dirname, '../frontend/build');
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const staticPath = fs.existsSync(frontendBuildPath) ? frontendBuildPath : (fs.existsSync(frontendDistPath) ? frontendDistPath : null);

if (staticPath) {
  app.use(express.static(staticPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}


const PORT = process.env.PORT || 5000;
let mongoConnectionPromise = null;

async function seedDefaultAdmin() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!username || !password) {
    console.warn('ADMIN_USERNAME or ADMIN_PASSWORD is not configured. Admin seeding skipped.');
    return;
  }

  const existingAdmin = await Admin.findOne({ username });
  const passwordHash = await bcrypt.hash(password, 10);

  if (!existingAdmin) {
    await Admin.create({ username, passwordHash });
    console.log(`Admin account created: ${username}`);
    return;
  }

  const passwordMatches = await bcrypt.compare(password, existingAdmin.passwordHash);

  if (!passwordMatches) {
    existingAdmin.passwordHash = passwordHash;
    await existingAdmin.save();
    console.log(`Admin password updated: ${username}`);
  }
}

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose
      .connect(process.env.MONGO_URI)
      .then(async () => {
        console.log('Mongo connected');
        await seedDefaultAdmin();
        return mongoose.connection;
      })
      .catch(error => {
        mongoConnectionPromise = null;
        throw error;
      });
  }

  return mongoConnectionPromise;
}

connectDatabase().catch(error => {
  console.error('Mongo connection error:', error);
});

if (require.main === module) {
  connectDatabase()
    .then(() => {
      app.listen(PORT, () => console.log('Server running on', PORT));
    })
    .catch(error => {
      console.error('Server startup failed:', error);
      process.exitCode = 1;
    });
}

module.exports = app;