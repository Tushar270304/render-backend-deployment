const mongoose = require('mongoose');
const subscriptionSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  planName: String,
  startDate: Date,
  endDate: Date,
  isActive: Boolean,
});

module.exports = mongoose.model('Subscription', subscriptionSchema);