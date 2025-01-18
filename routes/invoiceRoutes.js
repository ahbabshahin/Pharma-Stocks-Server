const express = require('express');
const router = express.Router();
const {
	createInvoice,
	getAllInvoices,
	getInvoice,
	updateInvoice,
	deleteInvoice,
	generatePDF,
} = require('../controllers/invoiceController');
const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');

// Create an invoice authenticateUser
router.post('/', authenticateUser, createInvoice);

// Get all invoices with pagination and filtering
router.get('/', authenticateUser, getAllInvoices);

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
