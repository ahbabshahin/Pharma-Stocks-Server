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
const createInvoice = async(req, res) => {
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
    console.log("products: ", products);

    if (!products || !customer) {
        throw new CustomError.BadRequestError("Products and customer are required");
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
            console.log("stock: ", stock);

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
                product._id, { $set: { quantity: updatedQuantity } }, { new: true }
            );
        }

        // Calculate total and subtotal
        const { subtotal, total } = calculateTotal(products, discount);
        if (totalAmount !== total) {
            res.status(500).json({ message: "Total amount is wrong", error });
        }

        // Initialize activity log with creation entry
        const initialActivityLog = [{
                name: req.user.name || "System", // Add name field
                action: "created",
                when: new Date(),
                user: req.user.userId,
                description: "Invoice created",
            },
            ...(activity_log || []).map((log) => ({
                ...log,
                name: log.name || req.user.name || "System", // Ensure all logs have a name
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
        if (sendPDF) {
            await generatePDF(invoice);
        }

        res.status(201).json({ body: invoice });
    } catch (error) {
        console.error("Error creating invoice:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// Get All Invoices with Pagination and Filtering
const getAllInvoices = async(req, res) => {
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
const updateInvoice = async(req, res) => {
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

            // Add activity log entry for the update
            const existingInvoice = await Invoice.findById(id);
            if (!existingInvoice) {
                throw new CustomError.NotFoundError(
                    `No invoice found with ID: ${id}`
                );
            }

            // Check for product quantity changes and update stock
            if (updateFields.products) {
                for (const updatedProduct of updateFields.products) {
                    const existingProduct = existingInvoice.products.find(
                        (p) => p._id === updatedProduct._id
                    );

                    if (existingProduct) {
                        const quantityDiff =
                            updatedProduct.quantity - existingProduct.quantity;

                        if (quantityDiff !== 0) {
                            // Find the product in inventory and update stock
                            const product = await Stock.findById(
                                updatedProduct._id
                            );
                            if (product) {
                                // If quantity increased, decrease stock
                                // If quantity decreased, increase stock
                                product.quantity -= quantityDiff;

                                if (product.quantity < 0) {
                                    throw new Error(
                                        `Insufficient stock for product: ${product.name}`
                                    );
                                }

                                await product.save();
                            }
                        }
                    }
                }
            }

            // Create update activity log entry
            const updateActivityLog = {
                    action: 'updated',
                    when: new Date(),
                    user: req.user.userId,
                    name: req.user.name,
                    description: `Invoice updated with changes: ${
				updateFields.amount && updateFields.amount !== existingInvoice.amount
					? `Amount changed from ${existingInvoice.amount} to ${updateFields.amount}. `
					: ''
			}${
				updateFields.products
					? `Products updated: ${updateFields.products
							.map(
								(p) => {
									const existingProd = existingInvoice.products.find(
										(ep) => ep._id === p._id
									);
									if (existingProd && existingProd.quantity !== p.quantity) {
										return `${p.name || 'Product'} quantity ${existingProd.quantity} -> ${p.quantity}`;
									}
									return null;
								}
							)
							.filter(Boolean)
							.join(', ')}. `
					: ''
			}${
				updateFields.status && updateFields.status !== existingInvoice.status
					? `Status changed from ${existingInvoice.status} to ${updateFields.status}. `
					: ''
			}${
				updateFields.dueDate && updateFields.dueDate !== existingInvoice.dueDate
					? `Due date changed from ${existingInvoice.dueDate} to ${updateFields.dueDate}. `
					: ''
			}`.trim(),
		};

		// Merge existing activity log with new log entry and any additional logs from request
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

// Search Invoices
const searchInvoices = async (req, res) => {
	const { startDate, endDate, customer } = req.query;
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;

	try {
		const queryObject = {};

		// Date range filter
		if (startDate || endDate) {
			queryObject.createdAt = {};
			if (startDate) {
				queryObject.createdAt.$gte = new Date(startDate);
			}
			if (endDate) {
				// Set endDate to end of day
				const endOfDay = new Date(endDate);
				endOfDay.setHours(23, 59, 59, 999);
				queryObject.createdAt.$lte = endOfDay;
			}
		}

		// If customer search is provided, first find matching customers
		if (customer) {
			const matchingCustomers = await Customer.find({
				name: { $regex: customer, $options: 'i' }
			}).select('_id');
			
			const customerIds = matchingCustomers.map(c => c._id.toString());
			if (customerIds.length > 0) {
				queryObject.customer = { $in: customerIds };
			} else {
				// If no matching customers found, return empty result
				return res.status(200).json({
					success: true,
					body: [],
					total: 0,
					page: Number(page),
					totalPages: 0,
					hasMore: false,
					filters: {
						dateRange: startDate || endDate ? { startDate, endDate } : null,
						customer: customer || null
					}
				});
			}
		}

		// Execute search query with customer population
		const invoices = await Invoice.find(queryObject)
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(Number(limit))
			.populate('user', 'username email')
			.populate('customer', 'name email contacts address'); // Populate customer details

		const totalInvoices = await Invoice.countDocuments(queryObject);

		res.status(200).json({
			success: true,
			body: invoices,
			total: totalInvoices,
			page: Number(page),
			totalPages: Math.ceil(totalInvoices / limit),
			hasMore: page * limit < totalInvoices,
			filters: {
				dateRange: startDate || endDate ? { startDate, endDate } : null,
				customer: customer || null
			}
		});
	} catch (error) {
		console.error('Error searching invoices:', error);
		res.status(500).json({
			success: false,
			message: 'Error searching invoices',
			error: error.message
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