const express = require('express');
const {
	registerUser,
	loginUser,
	logoutUser,
	updateUserProfile,
	editUserRole,
	getUser,
} = require('../controllers/userController');
const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');
const router = express.Router();
const { validateUser } = require('../middleware/validation');
// Register
router.post('/register', validateUser, registerUser);

// Login
router.post('/login', loginUser);

// Logout (Authenticated users only)
router.get('/logout', authenticateUser, logoutUser);

router.get('/user/:userId', authenticateUser, getUser);

// Update Profile (Authenticated users only)
router.put('/update-profile', authenticateUser, updateUserProfile);

// Edit Role (Admin only)
router.put(
	'/edit-role/:userId',
	authenticateUser,
	authorizePermissions('admin'),
	editUserRole
);

module.exports = router;
