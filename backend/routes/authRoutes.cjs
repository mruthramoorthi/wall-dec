const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authController = require('../controllers/authController.cjs');

const router = express.Router();

const IMAGE_STORE_DIR = path.join(__dirname, '..', '..', 'image-search-service', 'image-store');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(IMAGE_STORE_DIR, { recursive: true });
    cb(null, IMAGE_STORE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg') || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
    const filename = `avatar-${Date.now()}-${Math.round(Math.random() * 100000)}${safeExt}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed for profile picture.'));
  }
});

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/forgot-password/send-otp', authController.sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', authController.verifyForgotPasswordOtp);
router.post('/forgot-password/reset', authController.resetPasswordWithOtp);
router.get('/check-username/:username', authController.checkUsername);
router.post('/register', upload.single('profile_picture'), authController.register);
router.post('/login', authController.login);

// Profile endpoints
router.get('/profile/:uid', authController.getProfile);
router.put('/profile/:uid', upload.single('profile_picture'), authController.updateProfile);
router.post('/profile/:uid/change-password', authController.changePassword);

// User UI Preferences
router.get('/preferences/:uid', authController.getPreferences);
router.put('/preferences/:uid', authController.updatePreferences);

module.exports = router;
