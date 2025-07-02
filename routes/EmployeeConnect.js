// routes/connect.js
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

// POST: Connect device using connect code
router.post('/verify', async (req, res) => {
  const { connectCode, deviceId } = req.body;

  try {
    const employee = await Employee.findOne({ connectCode });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Invalid connect code' });
    }

    employee.deviceId = deviceId;
    await employee.save();

    res.json({ success: true, message: 'Device connected', employee });
  } catch (err) {
    console.error('Connect error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
