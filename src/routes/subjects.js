const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const subjectController = require('../controllers/subjectController');

router.get('/', verifyToken, requireRole('admin'), subjectController.getSubjects);
router.post('/', verifyToken, requireRole('admin'), subjectController.createSubject);
router.put('/:id', verifyToken, requireRole('admin'), subjectController.updateSubject);
router.delete('/:id', verifyToken, requireRole('admin'), subjectController.deleteSubject);

module.exports = router;