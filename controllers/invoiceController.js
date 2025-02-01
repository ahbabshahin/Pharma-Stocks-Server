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
	const { products, customer, sendPDF, status, sn, discount, totalAmount } =
		req.body;
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
		const { subtotal, total } = calculateTotal(products, discount);
		if(totalAmount !== total){
			res.status(500).json({ message: 'Total amount is wrong', error });
		}
		// Create the invoice
		const invoice = await Invoice.create({
			user: req.user.userId,
			status,
			products,
			customer,
			totalAmount,
			sn,
			discount,
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
	const { status, user, customer } = req.query;

	const page = parseInt(req.query.page, 10) || 1; // Default to page 1
	const limit = parseInt(req.query.limit, 10) || 10; // Default to limit 10

	const queryObject = {};
	// if (status) queryObject.status = status;
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
	let updateFields = req.body; // Contains all fields to update

	try {
		// Admin authorization
		if (req.user.role !== 'admin') {
			throw new CustomError.UnauthorizedError(
				'Only admin users can update invoices'
			);
		}

		// Ensure `_id` is not updated
		if (updateFields._id) {
			delete updateFields._id;
		}

		// Update the invoice
		const updatedInvoice = await Invoice.findByIdAndUpdate(
			id,
			updateFields, // Update with all provided fields except `_id`
			{ new: true, runValidators: true } // Return updated document & enforce schema validation
		);

		if (!updatedInvoice) {
			throw new CustomError.NotFoundError(
				`No invoice found with ID: ${id}`
			);
		}

		res.status(200).json({
			message: 'Invoice updated successfully',
			body: updatedInvoice,
		});
	} catch (error) {
		console.error('Error updating invoice:', error);
		res.status(500).json({
			message: 'Server error',
			error: error.message || 'Unknown error',
		});
	}
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
