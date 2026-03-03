const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireRole } = require('../middleware/auth');
const Room = require('../models/Room');
const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Notice = require('../models/Notice');
const OutingRequest = require('../models/OutingRequest');
const Contact = require('../models/Contact');
const User = require('../models/User');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

// Admin dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const [totalRooms, totalStudents, totalComplaints, totalNotices, totalOutings] =
      await Promise.all([
        Room.countDocuments(),
        Student.countDocuments(),
        Complaint.countDocuments(),
        Notice.countDocuments(),
        OutingRequest.countDocuments(),
      ]);

    const blocks = await Room.aggregate([
      { $group: { _id: { block: '$block', subBlock: '$subBlock' }, count: { $sum: 1 } } },
    ]);

    res.json({
      totalRooms,
      totalStudents,
      totalComplaints,
      totalNotices,
      totalOutings,
      blocks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

// ----- ROOMS -----

// Create a new room
router.post('/rooms', async (req, res) => {
  try {
    const { block, subBlock, roomNumber, capacity } = req.body;
    if (!block || !subBlock || !roomNumber || !capacity) {
      return res.status(400).json({ message: 'All room fields are required' });
    }
    const existing = await Room.findOne({ block, subBlock, roomNumber });
    if (existing) {
      return res.status(400).json({ message: 'Room already exists in this block' });
    }
    const beds = [];
    for (let i = 1; i <= Number(capacity); i += 1) {
      beds.push({ bedNumber: i, occupied: false });
    }
    const room = await Room.create({ block, subBlock, roomNumber, capacity, beds });
    res.status(201).json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create room' });
  }
});

// Room stats summary
router.get('/rooms/summary', async (req, res) => {
  try {
    const rooms = await Room.find().populate('beds.student');
    let occupiedBeds = 0;
    let totalBeds = 0;
    let totalStudents = 0;

    rooms.forEach((room) => {
      totalBeds += room.capacity;
      room.beds.forEach((bed) => {
        if (bed.occupied) {
          occupiedBeds += 1;
          totalStudents += 1;
        }
      });
    });

    res.json({
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter((r) => r.beds.some((b) => b.occupied)).length,
      availableRooms: rooms.filter((r) => r.beds.some((b) => !b.occupied)).length,
      totalStudents,
      occupiedBeds,
      availableBeds: totalBeds - occupiedBeds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load room summary' });
  }
});

// List rooms (optional filters)
router.get('/rooms', async (req, res) => {
  try {
    const { block, subBlock } = req.query;
    const query = {};
    if (block) query.block = block;
    if (subBlock) query.subBlock = subBlock;
    const rooms = await Room.find(query);
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to list rooms' });
  }
});

// Available rooms for registration (by block/subBlock)
router.get('/rooms/available', async (req, res) => {
  try {
    const { block, subBlock } = req.query;
    if (!block || !subBlock) {
      return res.status(400).json({ message: 'block and subBlock are required' });
    }
    const rooms = await Room.find({ block, subBlock });
    const result = rooms
      .map((room) => {
        const occupiedBeds = room.beds.filter((b) => b.occupied).length;
        const availableBeds = room.capacity - occupiedBeds;
        if (availableBeds <= 0) return null;
        return {
          id: room._id,
          roomNumber: room.roomNumber,
          capacity: room.capacity,
          occupiedBeds,
          availableBeds,
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load available rooms' });
  }
});

// Search room with bed layout
router.get('/rooms/search', async (req, res) => {
  try {
    const { block, subBlock, roomNumber } = req.query;
    if (!block || !subBlock || !roomNumber) {
      return res.status(400).json({ message: 'block, subBlock and roomNumber are required' });
    }
    const room = await Room.findOne({ block, subBlock, roomNumber }).populate({
      path: 'beds.student',
      model: 'Student',
    });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to search room' });
  }
});

// ----- STUDENT REGISTRATION -----

router.post('/students', async (req, res) => {
  try {
    const {
      name,
      rollNumber,
      branch,
      year,
      course,
      phone,
      email,
      parentName,
      parentPhone,
      feeTotal,
      feeDueDate,
      block,
      subBlock,
      roomId,
      studentUsername,
      studentPassword,
      parentUsername,
      parentPassword,
    } = req.body;

    if (!name || !rollNumber || !course || !block || !subBlock || !roomId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingStudent = await Student.findOne({ rollNumber });
    if (existingStudent) {
      return res.status(400).json({ message: 'Student with this roll number already exists' });
    }

    if (studentUsername && (await User.findOne({ username: studentUsername }))) {
      return res.status(400).json({ message: 'Student username already taken' });
    }
    if (parentUsername && (await User.findOne({ username: parentUsername }))) {
      return res.status(400).json({ message: 'Parent username already taken' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    const freeBed = room.beds.find((b) => !b.occupied);
    if (!freeBed) {
      return res.status(400).json({ message: 'Selected room is full' });
    }

    const student = await Student.create({
      name,
      rollNumber,
      branch,
      year,
      course,
      phone,
      email,
      parentName,
      parentPhone,
      room: room._id,
      bedNumber: freeBed.bedNumber,
      feeTotal: feeTotal || 0,
      feePaid: 0,
      feeDueDate: feeDueDate || null,
    });

    freeBed.occupied = true;
    freeBed.student = student._id;
    await room.save();

    let studentUser = null;
    let parentUser = null;

    if (studentUsername && studentPassword) {
      const hashed = await bcrypt.hash(studentPassword, 10);
      studentUser = await User.create({
        username: studentUsername,
        password: hashed,
        role: 'student',
        linkedStudent: student._id,
      });
    }
    if (parentUsername && parentPassword) {
      const hashedParent = await bcrypt.hash(parentPassword, 10);
      parentUser = await User.create({
        username: parentUsername,
        password: hashedParent,
        role: 'parent',
        linkedStudent: student._id,
      });
    }

    res.status(201).json({
      student,
      studentUser: studentUser ? { username: studentUser.username } : null,
      parentUser: parentUser ? { username: parentUser.username } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to register student' });
  }
});

// ----- FEES -----

router.get('/fees/summary', async (req, res) => {
  try {
    const students = await Student.find();
    let cleared = 0;
    let notCleared = 0;
    students.forEach((s) => {
      if (s.feeTotal && s.feePaid >= s.feeTotal) cleared += 1;
      else notCleared += 1;
    });
    res.json({ cleared, notCleared, total: students.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load fee summary' });
  }
});

router.get('/fees/:rollNumber', async (req, res) => {
  try {
    const student = await Student.findOne({ rollNumber: req.params.rollNumber });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load fee details' });
  }
});

router.post('/fees/:rollNumber/pay', async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be positive' });
    }
    const student = await Student.findOne({ rollNumber: req.params.rollNumber });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    student.feePaid += Number(amount);
    student.transactions.push({ amount, note });
    await student.save();
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to record payment' });
  }
});

// ----- COMPLAINTS -----

router.get('/complaints/summary', async (req, res) => {
  try {
    const byCategory = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const byPriority = await Complaint.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);
    res.json({ byCategory, byPriority });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load complaint summary' });
  }
});

router.get('/complaints', async (req, res) => {
  try {
    const { priority } = req.query;
    const query = {};
    if (priority) query.priority = priority;
    const complaints = await Complaint.find(query)
      .populate('student')
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load complaints' });
  }
});

router.patch('/complaints/:id/resolve', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    complaint.status = 'Resolved';
    await complaint.save();
    res.json(complaint);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to resolve complaint' });
  }
});

// ----- NOTICES -----

router.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ postedAt: -1 });
    res.json(notices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load notices' });
  }
});

router.post('/notices', async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required' });
    }
    const notice = await Notice.create({ title, body });
    res.status(201).json(notice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create notice' });
  }
});

router.delete('/notices/:id', async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notice deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete notice' });
  }
});

// ----- OUTING REQUESTS -----

router.get('/outings/pending', async (req, res) => {
  try {
    const outings = await OutingRequest.find({
      parentApproved: true,
      $or: [{ adminApproved: false }, { hodApproved: false }],
    })
      .populate('student')
      .sort({ createdAt: -1 });
    res.json(outings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load outing requests' });
  }
});

router.patch('/outings/:id/admin-approve', async (req, res) => {
  try {
    const outing = await OutingRequest.findById(req.params.id);
    if (!outing) {
      return res.status(404).json({ message: 'Outing request not found' });
    }
    outing.adminApproved = true;
    await outing.save();
    res.json(outing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to approve outing' });
  }
});

router.patch('/outings/:id/hod-approve', async (req, res) => {
  try {
    const outing = await OutingRequest.findById(req.params.id);
    if (!outing) {
      return res.status(404).json({ message: 'Outing request not found' });
    }
    outing.hodApproved = true;
    await outing.save();
    res.json(outing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to approve outing' });
  }
});

// ----- STUDENT DETAILS & VACATE -----

router.get('/students', async (req, res) => {
  try {
    const { roll } = req.query;
    const query = {};
    if (roll) query.rollNumber = roll;
    const students = await Student.find(query).populate('room');
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load students' });
  }
});

router.get('/students/:rollNumber', async (req, res) => {
  try {
    const student = await Student.findOne({ rollNumber: req.params.rollNumber }).populate('room');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load student' });
  }
});

router.delete('/students/:rollNumber', async (req, res) => {
  try {
    const student = await Student.findOne({ rollNumber: req.params.rollNumber });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Free up the room bed
    if (student.room) {
      const room = await Room.findById(student.room);
      if (room) {
        const bed = room.beds.find((b) => b.bedNumber === student.bedNumber);
        if (bed) {
          bed.occupied = false;
          bed.student = null;
        }
        await room.save();
      }
    }

    // Remove linked users (student and parent)
    await User.deleteMany({ linkedStudent: student._id });

    await Student.deleteOne({ _id: student._id });

    res.json({ message: 'Student vacated and data removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to vacate student' });
  }
});

// ----- CONTACTS -----

router.get('/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load contacts' });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const { name, role, phone, email } = req.body;
    if (!name || !role || !phone) {
      return res.status(400).json({ message: 'Name, role and phone are required' });
    }
    const contact = await Contact.create({ name, role, phone, email });
    res.status(201).json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create contact' });
  }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update contact' });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete contact' });
  }
});

module.exports = router;

