const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  listTrash,
  moveToTrash,
  restoreFromTrash,
  emptyTrash
} = require('../utils/inboxTrash');

const inboxRoles = requireRole('teacher', 'parent');

function userIdOf(req) {
  return req.user?.id || req.user?.userId;
}

router.get('/trash', verifyToken, inboxRoles, async (req, res) => {
  try {
    const trash = await listTrash(userIdOf(req));
    res.json(trash);
  } catch (error) {
    console.error('List inbox trash error:', error);
    res.status(500).json({ error: 'Server error loading trash' });
  }
});

router.post('/trash', verifyToken, inboxRoles, async (req, res) => {
  try {
    await moveToTrash(userIdOf(req), req.user.role, req.body?.item_type, req.body?.item_id);
    res.json({ message: 'Moved to trash' });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error moving item to trash'
    });
  }
});

router.post('/restore', verifyToken, inboxRoles, async (req, res) => {
  try {
    await restoreFromTrash(userIdOf(req), req.body?.item_type, req.body?.item_id);
    res.json({ message: 'Restored' });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.status ? error.message : 'Server error restoring item'
    });
  }
});

router.post('/empty', verifyToken, inboxRoles, async (req, res) => {
  try {
    await emptyTrash(userIdOf(req));
    res.json({ message: 'Trash emptied' });
  } catch (error) {
    console.error('Empty inbox trash error:', error);
    res.status(500).json({ error: 'Server error emptying trash' });
  }
});

module.exports = router;
