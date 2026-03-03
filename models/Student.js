const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rollNumber: { type: String, required: true, unique: true },
    branch: String,
    year: String,
    course: { type: String, enum: ['btech', 'diploma'] },
    phone: String,
    email: String,
    parentName: String,
    parentPhone: String,
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    bedNumber: Number,
    feeTotal: { type: Number, default: 0 },
    feePaid: { type: Number, default: 0 },
    feeDueDate: Date,
    transactions: [
      {
        amount: Number,
        date: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);

