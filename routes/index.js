const express = require('express');
const router = express.Router();

// Import all route files
const userRoutes = require('./userRoutes');
const stockRoutes = require('./stockRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const customerRoutes = require('./customerRoutes');

// Combine all routes with their specific prefixes
router.use('/auth', userRoutes);
router.use('/stock', stockRoutes);
router.use('/invoice', invoiceRoutes);
router.use('/customer', customerRoutes);

module.exports = router;
