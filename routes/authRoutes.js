const express = require('express');
const {
	registerUser,
	loginUser,
	logoutUser,
} = require('../controllers/authController');
const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');
const router = express.Router();
const { validateUser } = require('../middleware/validation');
// Register
router.post('/register', registerUser);

// Login
router.post('/login', loginUser);

// Logout (Authenticated users only)
router.get('/logout', authenticateUser, logoutUser);

module.exports = router;