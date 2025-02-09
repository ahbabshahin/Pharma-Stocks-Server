const mongoose = require('mongoose');
const validator = require('validator');
const uniqueValidator = require('mongoose-unique-validator');

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		required: [true, 'Username is required'],
		unique: true,
		minlength: [3, 'Username must be at least 3 characters long'],
	},
	name: {
		type: String,
		required: [true, 'Name is required'],
		minlength: [2, 'Name must be at least 2 characters long'],
	},
	email: {
		type: String,
		required: [true, 'Email is required'],
		unique: true,
		// validate: {
		// 	validator: validator.isEmail,
		// 	message: (props) => `${props.value} is not a valid email`,
		// },
	},
	password: {
		type: String,
		required: [true, 'Password is required'],
		minlength: [6, 'Password must be at least 6 characters long'],
	},
	role: {
		type: String,
		enum: ['admin', 'user'],
		default: 'user',
	},
});

// Apply unique validation plugin
userSchema.plugin(uniqueValidator, { message: '{PATH} must be unique' });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
