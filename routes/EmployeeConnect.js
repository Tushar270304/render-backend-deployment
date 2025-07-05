const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

// ✅ POST: Connect device using connect code
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

    console.log('🔗 Device connected to employee:', employee._id);
    res.json({ success: true, message: 'Device connected', employee });
  } catch (err) {
    console.error('❌ Connect error:', err.message);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
