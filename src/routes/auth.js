const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.me);
router.post('/change-password', verifyToken, authController.changePassword);
router.put('/change-password', verifyToken, authController.changePassword);
router.put('/profile', verifyToken, authController.updateProfile);

module.exports = router;
