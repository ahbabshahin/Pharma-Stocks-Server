const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CustomError = require('../errors'); // Add missing import

const getUsers = async(req, res) => {
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
            total: totalUsers,
            totalPages: Math.ceil(totalUsers / limitNum),
            page: pageNum,
            limit: limitNum,
            body: users,
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};


const getUser = async(req, res) => {
    const { id } = req.params || req.id; // Use id from params or the logged-in user

    try {
        const user = await User.findById(id).select('-password'); // Exclude the password field
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ body: user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const createUserByAdmin = async(req, res) => {
    const { name, username, email, role = 'user' } = req.body;

    if (!name || !username || !email) {
        return res.status(400).json({ message: 'Name, username, and email are required' });
    }

    try {
        const user = await User.create({
            name,
            username,
            email,
            role,
            isPasswordSet: false,
            activity_log: [{
                user: req.user.userId,
                name: req.user.name || 'Admin',
                action: 'create_user',
                description: `User created by admin with role: ${role}`
            }]
        });
        res.status(201).json({ message: 'User created successfully', body: user });
    } catch (error) {
        console.error('Error creating user by admin:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// First Login - Set Password API
const setPasswordOnFirstLogin = async(req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await User.findById(id);
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
const updateUserProfile = async(req, res) => {
        const { id } = req.params;
        const { name, username, email, password, newPassword, role } = req.body;

        try {
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const changes = [];
            const previousValues = {
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role
            };

            if (username && username !== user.username) changes.push('username');
            if (name && name !== user.name) changes.push('name');
            if (email && email !== user.email) changes.push('email');
            if (role && role !== user.role) changes.push('role');
            if (password && newPassword) changes.push('password');

            if (username) user.username = username;
            if (name) user.name = name;
            if (email) user.email = email;
            if (role) user.role = role;

            if (password && newPassword) {
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(400).json({ message: 'Incorrect current password' });
                }
                user.password = await bcrypt.hash(newPassword, 10);
            }

            // Add activity log entry
            user.activity_log.push({
                        user: req.user.userId,
                        name: req.user.name || 'User',
                        action: 'update_profile',
                        when: new Date(),
                        description: `Profile updated. Changed fields: ${changes.map(field => {
                    switch(field) {
                        case 'username':
                            return `username from "${previousValues.username}" to "${username}"`;
                        case 'name':
                            return `name from "${previousValues.name}" to "${name}"`;
                        case 'email':
                            return `email from "${previousValues.email}" to "${email}"`;
                        case 'role':
                            return `role from "${previousValues.role}" to "${role}"`;
                        case 'password':
                            return 'password changed';
                        default:
                            return field;
                    }
                }).join(', ')}`
            });

            await user.save();
            const userObject = user.toObject();
            delete userObject.password;
            res.json({ message: 'Profile updated successfully', body: userObject });
        } catch (error) {
            console.error('Error updating user profile:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
}

// Edit user role (admin only)
const editUserRole = async (req, res) => {
	const { id } = req.params;
	const { role } = req.body;

	try {
		const user = await User.findById(id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (!['admin', 'user'].includes(role)) {
			return res.status(400).json({ message: 'Invalid role' });
		}
		if (req.user.id === id) {
			return res.status(400).json({ message: 'Admins cannot edit their role' });
		}

		const oldRole = user.role;
		user.role = role;

		// Add activity log entry
		user.activity_log.push({
			user: req.user.userId,
			name: req.user.name || 'Admin',
			action: 'role_change',
			description: `User role changed from ${oldRole} to ${role}`
		});

		await user.save();
		res.json({ message: 'Role updated successfully', body: user });
	} catch (error) {
		res.status(500).json({ message: 'Server error' });
	}
};

const deleteUser = async (req, res) => {
	try {
		// Ensure only admin can delete users
		if (req.user.role !== 'admin') {
			return res
				.status(403)
				.json({ message: 'Only admins can delete users' });
		}

		const { id } = req.params;

		// Check if the user exists
		const user = await User.findById(id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Prevent admin from deleting themselves (optional)
		if (req.user.id === id) {
			return res
				.status(400)
				.json({ message: 'Admins cannot delete themselves' });
		}

		await User.findByIdAndDelete(id);
		res.status(200).json({ message: 'User deleted successfully' });
	} catch (error) {
		console.error('Error deleting user:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

module.exports = {
	getUsers,
	getUser,
	createUserByAdmin,
  setPasswordOnFirstLogin,
	updateUserProfile,
	editUserRole,
	deleteUser,
};