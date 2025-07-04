const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin'); // Mongoose model with pre-save hook

// ✅ Register Admin (no manual hashing)
router.post('/register', async (req, res) => {
  try {
    let { name, email, password, organizationId } = req.body;

    // Normalize inputs
    name = name?.trim();
    email = email?.trim().toLowerCase();
    password = password?.trim();

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    // 🔥 DO NOT HASH PASSWORD HERE — mongoose schema will do it
    const adminData = {
      name,
      email,
      password, // send plain text, schema will hash it
    };

    if (organizationId && organizationId.length === 24) {
      adminData.organizationId = organizationId;
    }

    const newAdmin = new Admin(adminData);
    await newAdmin.save();

    console.log('📥 Registration password (before hashing):', JSON.stringify(password));
    console.log('📦 Hashed password (after save):', newAdmin.password);

    res.json({ success: true, message: 'Admin registered successfully' });
  } catch (err) {
    console.error('❌ Error registering admin:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Login Admin
const bcrypt = require('bcryptjs'); // only needed here
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();
    password = password?.trim();

    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log('❌ Admin not found');
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    console.log('👉 Login Attempt:', email);
    console.log('👉 Plain password:', JSON.stringify(password));
    console.log('👉 Hashed in DB:', admin.password);

    const isMatch = await bcrypt.compare(password, admin.password);
    console.log('✅ Match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    res.json({ success: true, admin });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
