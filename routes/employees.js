const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const auth = require('../middleware/auth'); // ✅ Import auth

// 🔁 Safe connect code generator with uniqueness check
async function generateUniqueConnectCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let exists = null;

  do {
    code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    exists = await Employee.findOne({ connectCode: code });
  } while (exists);

  return code;
}

// ✅ POST: Create employee
router.post('/add', auth, async (req, res) => {
  const { name, phone, tags } = req.body;

  console.log('📥 Add employee request body:', req.body);

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required' });
  }

  try {
    const connectCode = await generateUniqueConnectCode();
    const employee = new Employee({ name, phone, connectCode, tags });

    await employee.save();
    console.log('✅ Employee created:', employee);

    res.json({ success: true, employee });
  } catch (err) {
    console.error('❌ Create employee error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create employee', error: err.message });
  }
});

// ✅ GET: All employees
router.get('/', auth, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    console.error('❌ Fetch employees error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch employees', error: err.message });
  }
});

module.exports = router;
