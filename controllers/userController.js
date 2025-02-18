const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getUsers = async (req, res) => {
	try {
		// Admin authorization
		if (req.user.role !== 'admin') {
			throw new CustomError.UnauthorizedError(
				'Only admin can access this resource'
			);
		}

		// Get pagination parameters from query
		const { page = 1, limit = 10 } = req.query;

		// Convert strings to numbers
		const pageNum = parseInt(page, 10);
		const limitNum = parseInt(limit, 10);

		// Calculate skip value
		const skip = (pageNum - 1) * limitNum;

		// Fetch users with pagination
		const users = await User.find()
			.select('-password') // Exclude passwords for security
			.skip(skip)
			.limit(limitNum);

		// Get the total count of users for metadata
		const totalUsers = await User.countDocuments();

		res.status(200).json({
			total:totalUsers,
			totalPages: Math.ceil(totalUsers / limitNum),
			page: pageNum,
			limit: limitNum,
			body:users,
		});
	} catch (error) {
		console.error('Error fetching users:', error);
		res.status(500).json({ message: 'Server error', error });
	}
};


const getUser = async (req, res) => {
	const { userId } = req.params || req.userId; // Use userId from params or the logged-in user

	try {
		const user = await User.findById(userId).select('-password'); // Exclude the password field
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.status(200).json({ body: user });
	} catch (error) {
		res.status(500).json({ message: 'Server error' });
	}
};

const createUserByAdmin = async (req, res) => {
	const { name, username, email, role = 'user' } = req.body;

	if (!name || !username || !email) {
		return res.status(400).json({ message: 'Name, username, and email are required' });
	}

	try {
		const user = await User.create({ name, username, email, role });
		res.status(201).json({ message: 'User created successfully', user });
	} catch (error) {
		console.error('Error creating user by admin:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

// First Login - Set Password API
const setPasswordOnFirstLogin = async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password) {
		return res.status(400).json({ message: 'Email and password are required' });
	}

	try {
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (user.isPasswordSet) {
			return res.status(400).json({ message: 'Password is already set' });
		}

		// Hash password and update user
		const hashedPassword = await bcrypt.hash(password, 10);
		user.password = hashedPassword;
		user.isPasswordSet = true;
		await user.save();

		res.status(200).json({ message: 'Password set successfully' });
	} catch (error) {
		console.error('Error setting password:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

// Update profile
const updateUserProfile = async (req, res) => {
	const { username, email, password, newPassword } = req.body;
	const userId = req.user.userId;

	try {
		const user = await User.findById(userId);

		if (username) user.username = username;
		if (email) user.email = email;

		if (password && newPassword) {
			const isMatch = await bcrypt.compare(password, user.password);
			if (!isMatch) {
				return res
					.status(400)
					.json({ message: 'Incorrect current password' });
			}
			user.password = await bcrypt.hash(newPassword, 10);
		}

		await user.save();
		res.json({ message: 'Profile updated successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error' });
	}
};

// Edit user role (admin only)
const editUserRole = async (req, res) => {
	const { userId } = req.params;
	const { role } = req.body;

	try {
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (!['admin', 'user'].includes(role)) {
			return res.status(400).json({ message: 'Invalid role' });
		}

		user.role = role;
		await user.save();

		res.json({ message: 'Role updated successfully', body: user });
	} catch (error) {
		res.status(500).json({ message: 'Server error' });
	}
};

module.exports = {
	getUsers,
	getUser,
	createUserByAdmin,
    setPasswordOnFirstLogin,
	updateUserProfile,
	editUserRole,
};
