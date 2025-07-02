// models/Employee.js
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: String,
  phone: String,
  connectCode: { type: String, unique: true },
  deviceId: String, // this will be set after connect
});

module.exports = mongoose.model('Employee', employeeSchema);
