const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
  deviceId: String,
  callerName: String,
  clientNumber: String,
  callType: String, // INCOMING, OUTGOING, MISSED
  duration: Number, // in seconds
  timestamp: Date,
  location: String,
  status: String, // Follow Up, Interested, etc.
});

module.exports = mongoose.model('CallLog', callLogSchema);
