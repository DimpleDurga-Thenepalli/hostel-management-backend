const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ['Doctor', 'HOD', 'Admin', 'Warden', 'Other'],
      required: true,
    },
    phone: { type: String, required: true },
    email: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);

