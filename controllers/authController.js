const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/constants');
// Register user
const registerUser = async (req, res) => {
	const { name, username, email, password } = req.body;

	// Check for missing fields
	if (!name || !username || !email || !password) {
		return res.status(400).json({ message: 'All fields are required' });
	}

	try {
		// Check if username or email already exists
		const userExists = await User.findOne({ $or: [{ username }, { email }] });
		if (userExists) {
			return res.status(400).json({ message: 'User with this email or username already exists' });
		}

		// Determine role for the first user
		const isFirstUser = (await User.countDocuments()) === 0;
		const role = isFirstUser ? 'admin' : config.DEFAULT_ROLE;

		// Hash password and save user
		const hashedPassword = await bcrypt.hash(password, 10);
		const user = await User.create({
			name,
			username,
			email,
			password: hashedPassword,
			role,
		});

		res.status(201).json({ message: 'User registered successfully' });
	} catch (error) {
		console.error('Error registering user:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

const checkUserExists = async (req, res) => {
    const { username } = req.params;

    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        const user = await User.findOne({ username }).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found', body: undefined });
        }

        res.status(200).json({ message: 'User found', body:user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};


// Login user
const loginUser = async (req, res) => {
	const { username, password } = req.body;

	try {
		const user = await User.findOne({ username });
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

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
	checkUserExists,
}