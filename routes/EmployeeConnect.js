const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const CallLog = require('../models/CallLog'); // ⬅️ Add this

const JWT_SECRET = process.env.JWT_SECRET;

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

    const oldDeviceId = employee.deviceId;

    // ✅ Step 1: Update employee deviceId
    employee.deviceId = deviceId;
    await employee.save();

    // ✅ Step 2: Migrate logs from old deviceId to new one
    if (oldDeviceId && oldDeviceId !== deviceId) {
      await CallLog.updateMany(
        { deviceId: oldDeviceId },
        { $set: { deviceId: deviceId } }
      );
      console.log(`📦 Migrated call logs from ${oldDeviceId} to ${deviceId}`);
    }

    // ✅ Step 3: Generate JWT
    const token = jwt.sign(
      { employeeId: employee._id, deviceId: employee.deviceId },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('🔗 Device connected to employee:', employee._id);

    res.json({ success: true, message: 'Device connected', employee, token });
  } catch (err) {
    console.error('❌ Connect error:', err.message);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
