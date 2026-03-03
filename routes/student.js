const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Notice = require('../models/Notice');
const OutingRequest = require('../models/OutingRequest');
const Contact = require('../models/Contact');
const Room = require('../models/Room');

const router = express.Router();

router.use(authMiddleware, requireRole('student'));

async function getStudentForUser(user) {
  if (!user.linkedStudent) return null;
  const student = await Student.findById(user.linkedStudent);
  return student;
}

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const [complaintsCount, outingsCount, notices] = await Promise.all([
      Complaint.countDocuments({ student: student._id }),
      OutingRequest.countDocuments({ student: student._id }),
      Notice.find().sort({ postedAt: -1 }).limit(5),
    ]);

    res.json({
      complaintsCount,
      outingsCount,
      fee: {
        total: student.feeTotal,
        paid: student.feePaid,
        due: (student.feeTotal || 0) - (student.feePaid || 0),
        dueDate: student.feeDueDate,
      },
      notices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

// Fees
router.get('/fees', async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    res.json({
      feeTotal: student.feeTotal,
      feePaid: student.feePaid,
      feeDueDate: student.feeDueDate,
      due: (student.feeTotal || 0) - (student.feePaid || 0),
      transactions: student.transactions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load fees' });
  }
});

// Complaints
router.get('/complaints', async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    const complaints = await Complaint.find({ student: student._id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load complaints' });
  }
});

router.post('/complaints', async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    const { category, priority, description } = req.body;
    if (!category || !description) {
      return res.status(400).json({ message: 'Category and description are required' });
    }

    let block = null;
    let subBlock = null;
    let roomNumber = null;

    if (student.room) {
      const room = await Room.findById(student.room);
      if (room) {
        block = room.block;
        subBlock = room.subBlock;
        roomNumber = room.roomNumber;
      }
    }

    const complaint = await Complaint.create({
      student: student._id,
      category,
      priority: priority || 'Normal',
      description,
      block,
      subBlock,
      roomNumber,
    });
    res.status(201).json(complaint);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create complaint' });
  }
});

// Notices
router.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ postedAt: -1 });
    res.json(notices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load notices' });
  }
});

// Outing requests
router.get('/outings', async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    const outings = await OutingRequest.find({ student: student._id }).sort({ createdAt: -1 });
    res.json(outings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load outings' });
  }
});

router.post('/outings', async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    const { reason, fromDate, toDate } = req.body;
    if (!reason || !fromDate || !toDate) {
      return res.status(400).json({ message: 'Reason, fromDate and toDate are required' });
    }
    const outing = await OutingRequest.create({
      student: student._id,
      reason,
      fromDate,
      toDate,
      parentApproved: false,
      adminApproved: false,
      hodApproved: false,
    });
    res.status(201).json(outing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create outing request' });
  }
});

// Contacts
router.get('/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load contacts' });
  }
});

module.exports = router;

