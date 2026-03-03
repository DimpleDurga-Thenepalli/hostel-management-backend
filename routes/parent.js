const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const Student = require('../models/Student');
const Notice = require('../models/Notice');
const OutingRequest = require('../models/OutingRequest');
const Contact = require('../models/Contact');

const router = express.Router();

router.use(authMiddleware, requireRole('parent'));

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

    const [outingsCount, notices] = await Promise.all([
      OutingRequest.countDocuments({ student: student._id }),
      Notice.find().sort({ postedAt: -1 }).limit(5),
    ]);

    res.json({
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
      parentApproved: true, // parent is raising it
      adminApproved: false,
      hodApproved: false,
    });
    res.status(201).json(outing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create outing request' });
  }
});

router.patch('/outings/:id/approve', async (req, res) => {
  try {
    const student = await getStudentForUser(req.user);
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    const outing = await OutingRequest.findOne({
      _id: req.params.id,
      student: student._id,
    });
    if (!outing) {
      return res.status(404).json({ message: 'Outing request not found' });
    }
    outing.parentApproved = true;
    await outing.save();
    res.json(outing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to approve outing request' });
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

