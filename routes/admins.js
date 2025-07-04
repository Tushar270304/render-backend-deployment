const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const Admin = require('../models/Admin');

// Register Admin
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, organizationId } = req.body;

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const adminData = {
      name,
      email,
      password: hashedPassword,
    };

    if (organizationId && organizationId.length === 24) {
      adminData.organizationId = organizationId;
    }

    const newAdmin = new Admin(adminData);
    await newAdmin.save();

    res.json({ success: true, message: 'Admin registered successfully' });
  } catch (err) {
    console.error('❌ Error registering admin:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log('❌ Admin not found');
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    console.log('👉 Login Attempt:', email);
    console.log('👉 Plain password:', password);
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
