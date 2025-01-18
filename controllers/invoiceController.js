const Invoice = require('../models/Invoice');
const Stock = require('../models/Stock');
const CustomError = require('../errors');
const { isTokenValid } = require('../utils');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Customer = require('../models/Customer');

const calculateTotal = (products, discountRate) => {
	const subtotal = products.reduce((acc, product) => {
		return acc + (product.price * product.quantity);
	}, 0);

	// Calculate discount and deduct it from subtotal
	const discountAmount = (subtotal * discountRate) / 100;
	const total = subtotal - discountAmount;

	return { subtotal, total };
};

// Create Invoice
const createInvoice = async (req, res) => {
	const { products, customer, sendPDF, status, sn } = req.body;
	console.log('products: ', products);

	if (!products || !customer) {
		throw new CustomError.BadRequestError(
			'Products and customer are required'
		);
	}

	try {
		// Check if the customer exists
		const existingCustomer = await Customer.findById(customer);
		if (!existingCustomer) {
			throw new CustomError.NotFoundError(
				`Customer with ID "${customer}" not found`
			);
		}

		// Check stock availability and update quantities
		for (const product of products) {
			const stock = await Stock.findById(product._id);
			console.log('stock: ', stock);

			if (!stock) {
				res.status(404).json({
					message: `Product "${product.name}" not found in stock`,
				});
			} else if (product.quantity > stock.quantity) {
				res.status(500).json({
					message: `Insufficient stock for product "${product.name}". Available quantity: ${stock.quantity}`,
				});
			}

			// Calculate the new stock quantity
			const updatedQuantity = stock.quantity - product.quantity;

			// Update stock directly with `$set`
			await Stock.findByIdAndUpdate(
				product._id,
				{ $set: { quantity: updatedQuantity } },
				{ new: true }
			);
		}

		// Calculate total and subtotal
		const { subtotal, total } = calculateTotal(products, 0.15);

		// Create the invoice
		const invoice = await Invoice.create({
			user: req.user.userId,
			status,
			products,
			customer,
			totalAmount: total,
			sn,
		});

		// Update the customer's invoices array
		existingCustomer.invoices.push(invoice._id);
		await existingCustomer.save();

		// Generate PDF if requested
		if (sendPDF) {
			await generatePDF(invoice);
		}

		res.status(201).json({ body: invoice });
	} catch (error) {
		console.error('Error creating invoice:', error);
		res.status(500).json({ message: 'Server error', error });
	}
};

// Get All Invoices with Pagination and Filtering
const getAllInvoices = async (req, res) => {
	const { page = 1, limit = 10, status, user, customer } = req.query;

	const queryObject = {};
	if (status) queryObject.status = status;
	if (user) queryObject.user = user;
	if (customer) queryObject.customer = { $regex: customer, $options: 'i' }; // case-insensitive search

	const invoices = await Invoice.find(queryObject)
		.skip((page - 1) * limit)
		.limit(Number(limit))
		.populate('user', 'username email'); // Optional: populate user data

	const totalInvoices = await Invoice.countDocuments(queryObject);
	res.status(200).json({
		body: invoices,
		total: totalInvoices,
		page: Number(page),
	});
};

// Get Single Invoice
const getInvoice = async (req, res) => {
	const { id } = req.params;

	const invoice = await Invoice.findById(id).populate(
		'user',
		'username email'
	);
	if (!invoice) {
		throw new CustomError.NotFoundError(`No invoice found with id: ${id}`);
	}

	res.status(200).json({ invoice });
};

// Update Invoice (Admin only)
const updateInvoice = async (req, res) => {
	const { id } = req.params;
	const { status } = req.body; // Only update status is allowed

	const invoice = await Invoice.findById(id);
	if (!invoice) {
		throw new CustomError.NotFoundError(`No invoice found with id: ${id}`);
	}

	// Admin authorization
	if (req.user.role !== 'admin') {
		throw new CustomError.UnauthorizedError(
			'Only admin can update invoice status'
		);
	}

	invoice.status = status;
	await invoice.save();

	res.status(200).json({ body: invoice });
};

// Delete Invoice
const deleteInvoice = async (req, res) => {
	const { id } = req.params;
	try {
		const invoice = await Invoice.findByIdAndDelete(id);
		if (!invoice) {
			throw new CustomError.NotFoundError(
				`No invoice found with id: ${id}`
			);
		}

		// await invoice.remove();
		res.status(204).send();
	} catch (error) {
		res.status(500).json({ message: 'Server error', error });
	}
};

// Generate PDF
const generatePDF = (invoice) => {
	const doc = new PDFDocument();
	const filename = `invoice_${invoice._id}.pdf`;
	const writeStream = fs.createWriteStream(`./invoices/${filename}`);

	doc.pipe(writeStream);
	doc.fontSize(20).text(`Invoice ID: ${invoice._id}`);
	doc.text(`Customer: ${invoice.customer?.name}`);
	doc.text(`Status: ${invoice.status}`);
	doc.text(`Total Amount: ${invoice.totalAmount}`);
	doc.text(`Created At: ${invoice.createdAt}`);

	doc.text('Products:');
	invoice.products.forEach((product) => {
		doc.text(
			`${product.name} - Quantity: ${product.quantity}, Price: ${product.price}`
		);
	});

	doc.end();

	return new Promise((resolve) => {
		writeStream.on('finish', resolve);
	});
};

module.exports = {
	createInvoice,
	getAllInvoices,
	getInvoice,
	updateInvoice,
	deleteInvoice,
	generatePDF,
};
