const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');

// POST: Create new subscription
router.post('/', async (req, res) => {
  try {
    const newSub = new Subscription(req.body);
    await newSub.save();
    res.json({ success: true, message: 'Subscription created' });
  } catch (err) {
    console.error('Error creating subscription:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET: All subscriptions
router.get('/', async (req, res) => {
  try {
    const subs = await Subscription.find();
    res.json(subs);
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
