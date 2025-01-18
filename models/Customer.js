const mongoose = require('mongoose');
const customerSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Name is required'],
		minlength: [2, 'Name must be at least 2 characters long'],
	},
	email:{
		type: String
	},
	contacts: {
		type: String,
		required: [true, 'Phone number is required'],
		unique: true,
	},
	address: {
		type: String,
		required: [true, 'Address is required'],
		minlength: [3, 'Address must be at least 3 characters long'],
	},
	img: {
		type:String
	},
	invoices: [
		{
			type: String,
		},
	],
});

module.exports =
	mongoose.models.Customer || mongoose.model('Customer', customerSchema);
