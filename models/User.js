const mongoose = require('mongoose');
const validator = require('validator');
const uniqueValidator = require('mongoose-unique-validator');
const config = require("../config/constants");
const activityLogSchema = require('./ActivityLog');

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
		validate: {
			validator: validator.isEmail,
			message: (props) => `${props.value} is not a valid email`,
		},
	},
	password: {
		type: String,
		minlength: [6, 'Password must be at least 6 characters long'],
		default: null, // Password is optional initially
	},
	role: {
		type: String,
		enum: config.ROLES,
		default: config.DEFAULT_ROLE,
	},
	isPasswordSet: {
		type: Boolean,
		default: true, // Track whether password is set
	},
	activity_log: [activityLogSchema],
});

// Apply unique validation plugin
userSchema.plugin(uniqueValidator, { message: '{PATH} must be unique' });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);