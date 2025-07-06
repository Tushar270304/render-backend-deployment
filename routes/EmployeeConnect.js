const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ POST: Connect device using connect code and return token
router.post('/verify', async (req, res) => {
  const { connectCode, deviceId } = req.body;

  console.log('🔌 Verify request body:', req.body);

  if (!connectCode || !deviceId) {
    return res.status(400).json({ success: false, message: 'Missing connect code or device ID' });
  }

  try {
    const normalizedCode = connectCode.trim().toUpperCase();
    const employee = await Employee.findOne({ connectCode: normalizedCode });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Invalid connect code' });
    }

    employee.deviceId = deviceId;
    await employee.save();

    // ✅ Generate JWT token for this employee
    const token = jwt.sign(
      { employeeId: employee._id, deviceId: employee.deviceId },
      JWT_SECRET,
      { expiresIn: '30d' } // optional expiry
    );

    console.log('🔗 Device connected to employee:', employee._id);

    // ✅ Send token back to client
    res.json({ success: true, message: 'Device connected', employee, token });
  } catch (err) {
    console.error('❌ Connect error:', err.message);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
