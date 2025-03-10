const express = require('express');
const router = express.Router();
const {
	createInvoice,
	getAllInvoices,
	getInvoice,
	updateInvoice,
	deleteInvoice,
	generatePDF,
	searchInvoices,
	getSalesByPrice,
	getSalesByQuantity,
	getMonthlySales,
	getYearlySales,
	getDailySalesForMonth,
	getProductSalesForMonth
} = require('../controllers/invoiceController');
const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');

// Create an invoice authenticateUser
router.post('/', authenticateUser, createInvoice);

// Get all invoices with pagination and filtering
router.get('/', authenticateUser, getAllInvoices);

// Sales Report Routes
router.get('/reports/by-price', authenticateUser, getSalesByPrice);
router.get('/reports/by-quantity', authenticateUser, getSalesByQuantity);
// router.get('/reports/monthly', authenticateUser, getMonthlySales);
router.get('/reports/yearly', authenticateUser, getYearlySales);
router.get('/reports/daily', authenticateUser, getDailySalesForMonth);
router.get('/reports/product-sales', authenticateUser, getProductSalesForMonth);


// Search invoices by date range and customer
// Query parameters:
// - startDate: start date for search (YYYY-MM-DD)
// - endDate: end date for search (YYYY-MM-DD)
// - customer: customer name to search for
// - page: page number (default: 1)
// - limit: items per page (default: 10)
router.get('/search', authenticateUser, searchInvoices);

// Get a single invoice by ID
router.get('/:id', authenticateUser, getInvoice);

// Update invoice (admin only)
router.patch(
	'/:id',
	authenticateUser,
	authorizePermissions('admin'),
	updateInvoice
);

// Delete invoice
router.delete(
	'/:id',
	authenticateUser,
	authorizePermissions('admin'),
	deleteInvoice
);

// PDF Generation Endpoint
router.get('/:id/pdf', authenticateUser, async (req, res) => {
	const { id } = req.params;

	const invoice = await Invoice.findById(id);
	if (!invoice) {
		throw new CustomError.NotFoundError(`No invoice found with id: ${id}`);
	}

	await generatePDF(invoice);
	res.status(200).json({ message: 'PDF generated successfully.' });
});

module.exports = router;
