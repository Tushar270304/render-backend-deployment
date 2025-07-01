const mongoose = require('mongoose');
const organizationSchema = new mongoose.Schema({
  name: String,
  address: String,
  industry: String,
  contactEmail: String,
  contactPhone: String,
});

module.exports = mongoose.model('Organization', organizationSchema);
