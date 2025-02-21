const express = require('express');
const {
	updateUserProfile,
	editUserRole,
	getUser,
	getUsers,
	createUserByAdmin,
	deleteUser,
} = require('../controllers/userController');
const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');
const router = express.Router();
const { validateUser } = require('../middleware/validation');

router.post('/', authenticateUser, authorizePermissions('admin'), createUserByAdmin)
router.get('/all', authenticateUser, getUsers);

router.patch('/:id', authenticateUser, updateUserProfile);

router.get('/:id', authenticateUser, getUser);
router.delete('/:id', authenticateUser, deleteUser);

// Update Profile (Authenticated users only)

// Edit Role (Admin only)
router.patch(
	'/edit-role/:id',
	authenticateUser,
	authorizePermissions('admin'),
	editUserRole
);

module.exports = router;
