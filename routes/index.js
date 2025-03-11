const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const stockRoutes = require('./stockRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const customerRoutes = require('./customerRoutes');
const salesReportRoutes = require('./salesReport');

// Combine all routes with their specific prefixes
router.use('/v1/auth', authRoutes);
router.use('/v1/user', userRoutes);
router.use('/v1/stock', stockRoutes);
router.use('/v1/invoice', invoiceRoutes);
router.use('/v1/customer', customerRoutes);
router.use('/v1/sales-report', salesReportRoutes);

module.exports = router;
