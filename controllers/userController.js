const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register user
const registerUser = async (req, res) => {
	const { name, userName, email, password } = req.body;

	try {
		let user = await User.findOne({ email });
		if (user) {
			return res.status(400).json({ message: 'User already exists' });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		user = new User({
			name,
			userName,
			email,
			password: hashedPassword,
		});

		await user.save();
		res.status(201).json({ message: 'User registered successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error' });
	}
};

// Login user
const loginUser = async (req, res) => {
	const { userName, password } = req.body;

	try {
		const user = await User.findOne({ userName });
		if (!user) {
			return res.status(400).json({ message: 'Invalid credentials' });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(400).json({ message: 'Invalid credentials' });
		}

		const token = jwt.sign(
			{ userId: user._id, role: user.role, name: user.name },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.JWT_LIFETIME }
		);

		res.cookie('accessToken', token, { httpOnly: true }).json({
			accessToken: token,
			message: 'Logged in successfully',
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error' });
	}
};

// Logout user
const logoutUser = (req, res) => {
	res.clearCookie('accessToken').json({ message: 'Logged out successfully' });
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

		res.json({ message: 'Role updated successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error' });
	}
};

module.exports = {
	registerUser,
	loginUser,
	logoutUser,
	getUser,
	updateUserProfile,
	editUserRole,
};
