const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema({
  bedNumber: Number,
  occupied: { type: Boolean, default: false },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
});

const roomSchema = new mongoose.Schema(
  {
    block: { type: String, enum: ['men', 'women'], required: true },
    subBlock: { type: String, enum: ['ac', 'non-ac'], required: true },
    roomNumber: { type: String, required: true },
    capacity: { type: Number, required: true },
    beds: [bedSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);

