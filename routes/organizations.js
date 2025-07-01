const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');


// POST: Create new organization
router.post('/', async (req, res) => {
  try {
    const exists = await Organization.findOne({ name: req.body.name });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Organization already exists' });
    }

    const newOrg = new Organization(req.body);
    await newOrg.save();
    res.json({ success: true, message: 'Organization created' });
  } catch (err) {
    console.error('Error creating organization:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// GET: All organizations
router.get('/', async (req, res) => {
  try {
    const orgs = await Organization.find();
    res.json(orgs);
  } catch (err) {
    console.error('Error fetching organizations:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching organization' });
  }
});


module.exports = router;
