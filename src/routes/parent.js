const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const parentController = require('../controllers/parentController');

router.get('/me', verifyToken, requireRole('parent'), parentController.getProfile);
router.get('/children', verifyToken, requireRole('parent'), parentController.getChildren);
router.get('/child/:id/attendance', verifyToken, requireRole('parent'), parentController.getChildAttendance);
router.get('/child/:id/stats', verifyToken, requireRole('parent'), parentController.getChildStats);
router.get('/child/:id/progress', verifyToken, requireRole('parent'), parentController.getChildProgress);
router.get('/child/:id/progress/:assessmentId/work', verifyToken, requireRole('parent'), parentController.getChildSubmission);
router.get('/child/:id/insights', verifyToken, requireRole('parent'), parentController.getChildInsights);
router.get('/child/:id/analytics/lessons', verifyToken, requireRole('parent'), parentController.getChildLessonAnalytics);
router.get('/child/:id/analytics/classwork', verifyToken, requireRole('parent'), parentController.getChildWeeklyClasswork);
router.get('/child/:id/analytics/attendance', verifyToken, requireRole('parent'), parentController.getChildAttendanceSummary);
router.get('/inbox', verifyToken, requireRole('parent'), parentController.getParentInbox);
router.post('/messages/mark-all-read', verifyToken, requireRole('parent'), parentController.markAllMessagesRead);
router.post('/messages/:id/read', verifyToken, requireRole('parent'), parentController.markMessageRead);
router.delete('/messages/:id/read', verifyToken, requireRole('parent'), parentController.markMessageRead);
router.get('/child/:id/teachers', verifyToken, requireRole('parent'), parentController.getChildTeachers);
router.get('/concerns', verifyToken, requireRole('parent'), parentController.getMyConcerns);
router.post('/concerns', verifyToken, requireRole('parent'), parentController.createConcern);
router.post('/concerns/:id/reply', verifyToken, requireRole('parent'), parentController.replyToConcern);
router.post('/concerns/:id/read', verifyToken, requireRole('parent'), parentController.markConcernRead);

module.exports = router;