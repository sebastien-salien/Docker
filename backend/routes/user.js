// Imports
const express = require('express');
const router = express.Router();
const usersCtrl = require('../controllers/user');
const auth = require('../middleware/auth');

// Multer
const uploadPhoto = require('../config/uploadPhoto.config.js');
const fileWorker = require('../controllers/image.js');

// Users routes
router.post('/signup', usersCtrl.signup);
router.post('/signup/email', usersCtrl.email);
router.post('/login', usersCtrl.login);
router.get('/user', usersCtrl.getUserAlreadyConnected)
router.get('/:userId', auth, usersCtrl.getUserProfile);
router.put('/:userId', auth, uploadPhoto.single("avatarUrl"), usersCtrl.updateUserProfile, fileWorker.updatePhoto);
router.delete('/:userId', auth, usersCtrl.deleteUser);

module.exports = router;