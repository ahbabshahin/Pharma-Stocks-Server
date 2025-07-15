const Invoice = require('../models/Invoice');
const Stock = require('../models/Stock');
const CustomError = require('../errors');
const { isTokenValid } = require('../utils');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Customer = require('../models/Customer');
const config = require("../config/constants");
const calculateTotal = (products, discountRate = 0) => {
    const subtotal = products.reduce((acc, product) => {
        return acc + product.price * product.quantity;
    }, 0);

    // Ensure discountRate is a valid number
    const validDiscountRate =
        isNaN(discountRate) || discountRate < 0 ? 0 : discountRate;

    // Calculate discount and deduct it from subtotal
    const discountAmount = (subtotal * validDiscountRate) / 100;
    const total = subtotal - discountAmount;

    return { subtotal, total, discountAmount };
};

// Create Invoice
const createInvoice = async (req, res) => {
	const {
		products,
		customer,
		sendPDF,
		status,
		sn,
		discount,
		totalAmount,
		activity_log,
	} = req.body;

	if (!products || !customer) {
		return res
			.status(400)
			.json({ message: 'Products and customer are required' });
	}

	try {
		// Check if the customer exists
		const existingCustomer = await Customer.findById(customer);
		if (!existingCustomer) {
			return res
				.status(404)
				.json({ message: `Customer with ID "${customer}" not found` });
		}

		// Check stock availability first
		const insufficientStock = [];
		for (const product of products) {
			const stock = await Stock.findById(product._id);

			if (!stock) {
				insufficientStock.push(
					`Product "${product.name}" not found in stock`
				);
			} else if (product.quantity > stock.quantity) {
				insufficientStock.push(
					`Insufficient stock for "${product.name}". Available: ${stock.quantity}, Requested: ${product.quantity}`
				);
			}
		}

		// If any stock issue exists, return error response
		if (insufficientStock.length > 0) {
			return res.status(400).json({
				message: 'Stock check failed',
				errors: insufficientStock,
			});
		}

		// Update stock quantities after successful check
		for (const product of products) {
			const stock = await Stock.findById(product._id);

			const updatedQuantity = stock.quantity - product.quantity;

			await Stock.findByIdAndUpdate(
				product._id,
				{ $set: { quantity: updatedQuantity } },
				{ new: true }
			);
		}

		// Calculate total and subtotal
		const { subtotal, total } = calculateTotal(products, discount);

		if (totalAmount !== total) {
			return res.status(400).json({ message: 'Total amount mismatch' });
		}

		// Initialize activity log
		const initialActivityLog = [
			{
				name: req.user.name || 'System',
				action: 'created',
				when: new Date(),
				user: req.user.userId,
				description: 'Invoice created',
			},
			...(activity_log || []).map((log) => ({
				...log,
				name: log.name || req.user.name || 'System',
			})),
		];

		// Create the invoice
		const invoice = await Invoice.create({
			user: req.user.userId,
			status,
			products,
			customer,
			totalAmount,
			sn,
			discount,
			activity_log: initialActivityLog,
		});

		// Update the customer's invoices array
		existingCustomer.invoices.push(invoice._id);
		await existingCustomer.save();

		// Generate PDF if requested
		// if (sendPDF) {
		// 	await generatePDF(invoice);
		// }

		res.status(201).json({ body: invoice });
	} catch (error) {
		console.error('Error creating invoice:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
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

	try {
		const invoices = await Invoice.find(queryObject)
			.sort({ createdAt: -1 }) // Sort by latest
			.skip((page - 1) * limit)
			.limit(Number(limit))
			.populate('user', 'username email');

		const totalInvoices = await Invoice.countDocuments(queryObject);

		res.status(200).json({
			body: invoices,
			total: totalInvoices,
			page: Number(page),
		});
	} catch (error) {
		console.error('Error fetching invoices:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};


// Get Single Invoice
const getInvoice = async(req, res) => {
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

		// Fetch the existing invoice
		const existingInvoice = await Invoice.findById(id);
		if (!existingInvoice) {
			throw new CustomError.NotFoundError(
				`No invoice found with ID: ${id}`
			);
		}

		// Check for product quantity changes
		if (updateFields.products) {
			const insufficientStock = [];
			const quantityChanges = [];

			for (const updatedProduct of updateFields.products) {
				const existingProduct = existingInvoice.products.find(
					(p) => p._id === updatedProduct._id
				);

				if (existingProduct) {
					const quantityDiff =
						updatedProduct.quantity - existingProduct.quantity;

					if (quantityDiff !== 0) {
						const product = await Stock.findById(
							updatedProduct._id
						);

						if (!product) {
							insufficientStock.push(
								`Product "${updatedProduct.name}" not found in stock`
							);
						} else if (product.quantity - quantityDiff < 0) {
							insufficientStock.push(
								`Insufficient stock for "${updatedProduct.name}". Available: ${product.quantity}, Requested Change: ${quantityDiff}`
							);
						} else {
							quantityChanges.push({ product, quantityDiff });
						}
					}
				}
			}

			// If any stock issue exists, return error response
			if (insufficientStock.length > 0) {
				return res.status(400).json({
					message: 'Stock check failed',
					errors: insufficientStock,
				});
			}

			// Update stock after successful check
			for (const { product, quantityDiff } of quantityChanges) {
				product.quantity -= quantityDiff;
				await product.save();
			}
		}

		// Create update activity log entry
		const updateActivityLog = {
			action: 'updated',
			when: new Date(),
			user: req.user.userId,
			name: req.user.name,
			description: `Invoice updated with changes: ${
				updateFields.amount &&
				updateFields.amount !== existingInvoice.amount
					? `Amount changed from ${existingInvoice.amount} to ${updateFields.amount}. `
					: ''
			}${
				updateFields.products
					? `Products updated: ${updateFields.products
							.map((p) => {
								const existingProd =
									existingInvoice.products.find(
										(ep) => ep._id === p._id
									);
								if (
									existingProd &&
									existingProd.quantity !== p.quantity
								) {
									return `${p.name || 'Product'} quantity ${
										existingProd.quantity
									} -> ${p.quantity}`;
								}
								return null;
							})
							.filter(Boolean)
							.join(', ')}. `
					: ''
			}${
				updateFields.status &&
				updateFields.status !== existingInvoice.status
					? `Status changed from ${existingInvoice.status} to ${updateFields.status}. `
					: ''
			}${
				updateFields.dueDate &&
				updateFields.dueDate !== existingInvoice.dueDate
					? `Due date changed from ${existingInvoice.dueDate} to ${updateFields.dueDate}. `
					: ''
			}`.trim(),
		};

		// Merge activity logs
		const updatedActivityLog = [
			...(existingInvoice.activity_log || []),
			updateActivityLog,
			...(updateFields.activity_log || []),
		];
		updateFields.activity_log = updatedActivityLog;

		// Update the invoice
		const updatedInvoice = await Invoice.findByIdAndUpdate(
			id,
			updateFields,
			{
				new: true,
				runValidators: true,
			}
		);

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
		const invoice = await Invoice.findById(id);
		if (!invoice) {
			throw new CustomError.NotFoundError(
				`No invoice found with id: ${id}`
			);
		}

		// Restore stock for each product in the invoice if it's a due
        if (invoice.status === 'due'){
			for (const product of invoice.products) {
				const stockItem = await Stock.findById(product._id);
				if (stockItem) {
					stockItem.quantity += product.quantity;
					await stockItem.save();
				}
			}
        }
		// Delete the invoice
		await Invoice.findByIdAndDelete(id);

		res.status(204).send();
	} catch (error) {
		console.error('Error deleting invoice:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
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

// Search Invoices
const searchInvoices = async (req, res) => {
	const { page = 1, limit = 10, search, startDate, endDate, status } = req.query;

	// Input validation
	const pageNum = parseInt(page, 10) || 1;
	const limitNum = Math.min(parseInt(limit, 10) || 10, 100); // Cap limit at 100

	if (pageNum < 1) {
		return res.status(400).json({
			success: false,
			message: 'Page number must be positive',
		});
	}

	try {
		const queryObject = {};

		// Date range filter
		if (startDate || endDate) {
			queryObject.createdAt = {};
			if (startDate) {
				const start = new Date(startDate);
				if (isNaN(start)) throw new Error('Invalid start date');
				queryObject.createdAt.$gte = start;
			}
			if (endDate) {
				const end = new Date(endDate);
				if (isNaN(end)) throw new Error('Invalid end date');
				end.setHours(23, 59, 59, 999);
				queryObject.createdAt.$lte = end;
			}
		}

		if(status){
			queryObject.status = {};
			queryObject.status = status
		}

		// Add search filters (case-insensitive)
		if (search) {
			const customerQuery = { name: { $regex: search, $options: 'i' } };
			const matchingCustomers = await Customer.find(customerQuery)
				.select('_id')
				.lean(); // Use lean() for better performance

			const customerIds = matchingCustomers.map((c) => c._id);

			queryObject.$or = [
				{ sn: { $regex: search, $options: 'i' } },
				// { status: { $regex: status, $options: 'i' } },
			];

			if (customerIds.length > 0) {
				queryObject.$or.push({ customer: { $in: customerIds } });
			}
		}

		// Execute queries concurrently for better performance
		const [invoices, totalInvoices] = await Promise.all([
			Invoice.find(queryObject)
				.sort({ createdAt: -1 })
				.skip((pageNum - 1) * limitNum)
				.limit(limitNum)
				.populate({
					path: 'user',
					select: 'username email',
				})
				.populate({
					path: 'customer',
					select: 'name email contacts address',
				})
				.lean(), // Use lean() for better performance
			Invoice.countDocuments(queryObject),
		]);

		return res.status(200).json({
			success: true,
			body: invoices,
			total: totalInvoices,
			page: pageNum,
			totalPages: Math.ceil(totalInvoices / limitNum),
			hasMore: pageNum * limitNum < totalInvoices,
			filters: {
				search: search || null,
				dateRange: startDate || endDate ? { startDate, endDate } : null,
			},
		});
	} catch (error) {
		console.error('Error searching invoices:', error);
		return res.status(500).json({
			success: false,
			message: 'Error searching invoices',
			error: error.message,
		});
	}
};

// Get Sales Report by Price


module.exports = {
	createInvoice,
	getAllInvoices,
	getInvoice,
	updateInvoice,
	deleteInvoice,
	generatePDF,
	searchInvoices,
};