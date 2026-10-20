const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { bulkUpload } = require('../utils/tabularUpload');

function acceptBulkFile(req, res, next) {
  bulkUpload()(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    next();
  });
}

// Accounts
router.post('/accounts', verifyToken, requireRole('admin'), adminController.createAccount);
router.post('/accounts/bulk', verifyToken, requireRole('admin'), acceptBulkFile, adminController.bulkCreateAccounts);
router.get('/accounts', verifyToken, requireRole('admin'), adminController.getAccounts);
router.get('/accounts/:id', verifyToken, requireRole('admin'), adminController.getAccountById);
router.put('/accounts/:id', verifyToken, requireRole('admin'), adminController.updateAccount);
router.put('/accounts/:id/assignments', verifyToken, requireRole('admin'), adminController.updateAssignments);
router.patch('/accounts/:id/status', verifyToken, requireRole('admin'), adminController.toggleStatus);
router.post('/accounts/:id/transfer-deactivate', verifyToken, requireRole('admin'), adminController.transferAndDeactivate);
router.post('/accounts/:id/reset-password', verifyToken, requireRole('admin'), adminController.resetAccountPassword);

// Sections & Subjects
router.get('/sections', verifyToken, requireRole('admin'), adminController.getSections);
router.get('/subjects', verifyToken, requireRole('admin'), adminController.getSubjects);
router.get('/class-adviser', verifyToken, requireRole('admin'), adminController.getClassAdviser);
router.get('/class-slots', verifyToken, requireRole('admin'), adminController.getClassSlots);

// Activity & Inbox
router.get('/overview-charts', verifyToken, requireRole('admin'), adminController.getOverviewCharts);
router.get('/activity-log', verifyToken, requireRole('admin'), adminController.getActivityLog);
router.get('/inbox', verifyToken, requireRole('admin'), adminController.getAdminInbox);
router.get('/settings', verifyToken, requireRole('admin'), adminController.getSchoolSettings);
router.put('/settings/current-quarter', verifyToken, requireRole('admin'), adminController.updateCurrentQuarter);
router.post('/announcements', verifyToken, requireRole('admin'), adminController.createAnnouncement);
router.put('/announcements/:id', verifyToken, requireRole('admin'), adminController.updateAnnouncement);
router.delete('/announcements/:id', verifyToken, requireRole('admin'), adminController.deleteAnnouncement);
router.patch('/concerns/:id/resolve', verifyToken, requireRole('admin'), adminController.resolveConcern);
router.post('/concerns/:id/reply', verifyToken, requireRole('admin'), adminController.replyToConcern);
router.post('/concerns/:id/read', verifyToken, requireRole('admin'), adminController.markConcernRead);
router.post('/announcements/:id/read', verifyToken, adminController.markAnnouncementRead);
router.delete('/announcements/:id/read', verifyToken, adminController.markAnnouncementUnread);
router.post('/announcements/mark-all-read', verifyToken, adminController.markAllAnnouncementsRead);

// Parents & Detail views
router.get('/parents', verifyToken, requireRole('admin'), adminController.getParents);
router.get('/teachers/:id/detail', verifyToken, requireRole('admin'), adminController.getTeacherDetail);
router.get('/parents/:id/detail', verifyToken, requireRole('admin'), adminController.getParentDetail);

module.exports = router;