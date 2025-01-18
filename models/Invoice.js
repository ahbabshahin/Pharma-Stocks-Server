const mongoose = require('mongoose');
const invoiceSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	products: [
		{
			_id: {
				type: String,
			},
			name: {
				type: String,
			},
			quantity: {
				type: Number,
				min: [1, 'Quantity must be at least 1'],
			},
			price: {
				type: Number,
				min: [0, 'Price must be a positive value'],
			},
		},
	],
	discount: {
		type: Number,
		default: 0.15, // 15% tax rate
	},
	totalAmount: {
		type: Number,
	},
	status: {
		type: String,
		enum: ['paid', 'due'],
		default: 'due',
	},
	customer: {
			type: String,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	sn:{
		type:String,
	}
});

invoiceSchema.pre('save', function (next) {
	let total = 0;
	this.products.forEach((product) => {
		total += product.price * product.quantity;
	});
	this.totalAmount = total + total * this.taxRate;
	next();
});

// module.exports = mongoose.model('Invoice', invoiceSchema);
module.exports =
	mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
