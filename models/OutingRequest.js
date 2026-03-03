const mongoose = require('mongoose');

const outingRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    reason: { type: String, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    parentApproved: { type: Boolean, default: false },
    adminApproved: { type: Boolean, default: false },
    hodApproved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OutingRequest', outingRequestSchema);

