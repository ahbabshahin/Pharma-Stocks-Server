const express = require('express');
const {
	registerUser,
	loginUser,
	logoutUser,
	checkUserExists,
} = require('../controllers/authController');
const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');
const router = express.Router();
const { validateUser } = require('../middleware/validation');
// Register
router.post('/register', registerUser);

router.get('/check-user/:username', checkUserExists);
// Login
router.post('/login', loginUser);

// Logout (Authenticated users only)
router.get('/logout', authenticateUser, logoutUser);

module.exports = router;