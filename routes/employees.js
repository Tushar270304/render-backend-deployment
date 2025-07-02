const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

function generateConnectCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST: Create employee
router.post('/add', async (req, res) => {
  const { name, phone } = req.body;

  try {
    const connectCode = generateConnectCode();
    const employee = new Employee({ name, phone, connectCode });

    await employee.save();
    res.json({ success: true, employee });
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ success: false, message: 'Failed to create employee' });
  }
});

// GET: All employees
router.get('/', async (req, res) => {
  const employees = await Employee.find().sort({ name: 1 });
  res.json(employees);
});

module.exports = router;
