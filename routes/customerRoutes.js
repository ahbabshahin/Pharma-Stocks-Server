const express = require('express');
const {
	createCustomer,
	getAllCustomers,
	getCustomer,
	updateCustomer,
	deleteCustomer,
	updateCustomerInvoices,
	searchCustomers,
} = require('../controllers/customerController');

const router = express.Router();

const {
	authenticateUser,
	authorizePermissions,
} = require('../middleware/authentication');

router
	.route('/')
	.post(authenticateUser, createCustomer)
	.get(authenticateUser, authorizePermissions('admin'), getAllCustomers);
	
router.get('/search', authenticateUser, searchCustomers); // Add search route

	router.get('/search', authenticateUser, searchCustomers); // Add search route
	
router
	.route('/:id')
	.get(authenticateUser, getCustomer)
	.put(authenticateUser, authorizePermissions('admin'), updateCustomer)
	.delete(authenticateUser, authorizePermissions('admin'), deleteCustomer);

router
	.route('/invoices/:customerId')
	.post(authenticateUser, updateCustomerInvoices);

// router.route('/search').get(authenticateUser, searchCustomers);


module.exports = router;
