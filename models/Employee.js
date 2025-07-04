const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    connectCode: { type: String, unique: true },
    deviceId: String,
    tags: [String], // 🆕 tags array
  },
  { timestamps: true } // ⏱ adds createdAt and updatedAt
);

module.exports = mongoose.model('Employee', employeeSchema);
