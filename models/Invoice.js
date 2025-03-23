const mongoose = require('mongoose');
const config = require("../config/constants");
const activityLogSchema = require('./ActivityLog');

const invoiceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    products: [{
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
    }, ],
    discount: {
        type: Number,
        default: config.TAX_RATE, // 15% tax rate
    },
    totalAmount: {
        type: Number,
    },
    status: {
        type: String,
        enum: config.STATUS,
        default: config.DEFAULT_STATUS,
    },
    customer: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    sn: {
        type: String,
    },
    activity_log: {
        type: [activityLogSchema],
        required: false
    },

});

invoiceSchema.pre('save', function(next) {
    if (!this.products || this.products.length === 0) {
        return next(new Error('Invoice must contain at least one product.'));
    }

    // Calculate subtotal
    const subtotal = this.products.reduce((acc, product) => {
        return acc + product.price * product.quantity;
    }, 0);

    // Ensure discount is valid, default to 0 if undefined
    const discountRate = this.discount || 0;
    const discountAmount = (subtotal * discountRate) / 100;

    // Calculate total amount after discount
    this.totalAmount = subtotal - discountAmount;

    next();
});

// module.exports = mongoose.model('Invoice', invoiceSchema);
module.exports =
    mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);