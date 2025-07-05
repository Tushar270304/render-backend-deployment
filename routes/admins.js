const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET;

// Register
router.post('/register', async (req, res) => {
  try {
    let { name, email, password, organizationId } = req.body;
    email = email?.trim().toLowerCase();

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const newAdmin = new Admin({ name, email, password, organizationId });
    await newAdmin.save();

    res.json({ success: true, message: 'Admin registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email?.trim().toLowerCase();

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });

    const token = jwt.sign({ adminId: admin._id, email: admin.email, organizationId: admin.organizationId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, admin, token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;