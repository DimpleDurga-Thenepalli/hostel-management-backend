const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');

const router = express.Router();

// Helper to generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

// Seed a demo admin on first request if not present
router.get('/seed-demo', async (req, res) => {
  try {
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      admin = await User.create({
        username: 'admin',
        password: hashed,
        role: 'admin',
      });
    }
    res.json({ message: 'Demo admin ensured', username: 'admin', password: 'admin123' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error seeding admin' });
  }
});

// Login for admin, student, parent
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password and role are required' });
  }

  try {
    const user = await User.findOne({ username, role });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    let student = null;
    if (user.linkedStudent) {
      student = await Student.findById(user.linkedStudent);
    }

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        linkedStudent: user.linkedStudent,
      },
      student,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

