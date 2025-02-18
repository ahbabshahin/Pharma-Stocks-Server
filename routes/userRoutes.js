const express = require('express');
const {
	updateUserProfile,
	editUserRole,
	getUser,
	getUsers,
	createUserByAdmin,
} = require('../controllers/userController');
const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');
const router = express.Router();
const { validateUser } = require('../middleware/validation');

router.post('/', authenticateUser, authorizePermissions('admin'), createUserByAdmin)
router.get('/all', authenticateUser, getUsers);

router.patch('/update-profile', authenticateUser, updateUserProfile);

router.get('/user/:userId', authenticateUser, getUser);

// Update Profile (Authenticated users only)

// Edit Role (Admin only)
router.patch(
	'/edit-role/:userId',
	authenticateUser,
	authorizePermissions('admin'),
	editUserRole
);

module.exports = router;
