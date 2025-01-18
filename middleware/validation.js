const { check } = require('express-validator');

const validateUser = [
	check('username')
		.isLength({ min: 3 })
		.withMessage('Username must be at least 3 characters long'),
	check('email').isEmail().withMessage('Please provide a valid email'),
	check('password')
		.isLength({ min: 6 })
		.withMessage('Password must be at least 6 characters long'),
];

const validateInvoice = [
	check('products').isArray().withMessage('Products must be an array'),
	check('products.*.name').notEmpty().withMessage('Product name is required'),
	check('products.*.quantity')
		.isInt({ min: 1 })
		.withMessage('Quantity must be at least 1'),
	check('products.*.price')
		.isFloat({ gt: 0 })
		.withMessage('Price must be greater than 0'),
];

module.exports = {
	validateUser,
	validateInvoice,
};
