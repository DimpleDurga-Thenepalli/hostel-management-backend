const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    category: {
      type: String,
      enum: ['Water', 'Electricity', 'Infrastructure', 'Food', 'Others'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['Urgent', 'Normal', 'Cool'],
      default: 'Normal',
    },
    description: { type: String, required: true },
    block: { type: String },
    subBlock: { type: String },
    roomNumber: { type: String },
    status: {
      type: String,
      enum: ['Open', 'Resolved'],
      default: 'Open',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);

