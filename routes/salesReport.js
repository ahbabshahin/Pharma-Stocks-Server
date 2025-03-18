const express = require('express');
const router = express.Router();
const {
    getSalesByPrice,
    getSalesByQuantity,
    getYearlySales,
    getDailySalesForMonth,
    getProductSalesForMonth,
    getDailySoldProductForMonth
} = require('../controllers/salesReportController');
const { authenticateUser } = require('../middleware/authentication');

// Get all sales reports
router.get('/by-price', authenticateUser, getSalesByPrice);
router.get('/by-quantity', authenticateUser, getSalesByQuantity);
// router.get('/monthly', authenticateUser, getMonthlySales);
router.get('/yearly', authenticateUser, getYearlySales);
router.get('/daily', authenticateUser, getDailySalesForMonth);
router.get('/daily/quantity', authenticateUser, getDailySoldProductForMonth);
router.get('/product-sales', authenticateUser, getProductSalesForMonth);

module.exports = router;