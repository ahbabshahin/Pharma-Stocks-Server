const Invoice = require('../models/Invoice');

const getSalesByPrice = async(req, res) => {
    try {
        const salesByProduct = await Invoice.aggregate([
            { $match: { status: 'paid' } }, // Filter only paid invoices
            { $unwind: '$products' }, // Deconstruct the products array
            {
                $group: {
                    _id: { name: '$products.name', price: '$products.price' }, // Group by product name & price
                    totalQuantity: { $sum: '$products.quantity' }, // Sum total quantity sold
                    totalRevenue: {
                        $sum: { $multiply: ['$products.price', '$products.quantity'] }
                    } // Calculate total revenue
                }
            },
            { $sort: { totalRevenue: -1 } } // Sort by revenue (highest to lowest)
        ]);

        res.status(200).json({
            success: true,
            body: salesByProduct.map(item => ({
                product: item._id.name,
                price: item._id.price,
                totalQuantity: item.totalQuantity,
                totalRevenue: item.totalRevenue
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating sales by product report',
            error: error.message
        });
    }
};


// Get Sales Report by Quantity
const getSalesByQuantity = async(req, res) => {
    try {
        const salesByQuantity = await Invoice.aggregate([
            { $match: { status: 'paid' } },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.name',
                    totalQuantity: { $sum: '$products.quantity' },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$products.price', '$products.quantity']
                        }
                    },
                    averagePrice: { $avg: '$products.price' }
                }
            },
            { $sort: { totalQuantity: -1 } }
        ]);

        res.status(200).json({
            success: true,
            body: salesByQuantity
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating sales by quantity report',
            error: error.message
        });
    }
};

// Get Monthly Sales Report
// Get daily sales for a specific month
const getDailySalesForMonth = async(req, res) => {
    try {
        // Validate date parameter
        const { date } = req.query;
        if (!date || !Date.parse(date)) {
            return res.status(400).json({
                success: false,
                message: 'Valid date parameter is required (YYYY-MM-DD format)',
            });
        }

        // Calculate start and end of month
        const targetDate = new Date(date);
        const startOfMonth = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            1
        );
        const endOfMonth = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth() + 1,
            0,
            23,
            59,
            59
        );

        // Get daily sales data
        const dailySales = await Invoice.aggregate([
            // Match paid invoices within date range
            {
                $match: {
                    status: 'paid',
                    createdAt: {
                        $gte: startOfMonth,
                        $lte: endOfMonth,
                    },
                },
            },
            // Group by date and calculate metrics
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                    },
                    totalRevenue: { $sum: '$totalAmount' },
                    totalInvoices: { $sum: 1 },
                    averageInvoiceValue: { $avg: '$totalAmount' },
                },
            },
            // Round values and format output
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            format: '%d-%m-%Y',
                            date: {
                                $dateFromParts: {
                                    year: '$_id.year',
                                    month: '$_id.month',
                                    day: '$_id.day',
                                },
                            },
                        },
                    },
                    totalRevenue: { $round: ['$totalRevenue', 2] }, // Correct usage
                    totalInvoices: 1,
                    averageInvoiceValue: {
                        $round: ['$averageInvoiceValue', 2],
                    }, // Correct usage
                },
            },
            // Sort by date ascending
            { $sort: { date: 1 } },
        ]);

        // Return empty array if no data found
        if (!dailySales.length) {
            return res.status(200).json({
                success: true,
                message: 'No sales data found for the specified month',
                body: [],
            });
        }

        res.status(200).json({
            success: true,
            body: dailySales,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating daily sales report',
            error: error.message,
        });
    }
};


// Get product sales revenue for a specific month
const getProductSalesForMonth = async(req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required (YYYY-MM-DD format)'
            });
        }

        const targetDate = new Date(date);
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

        const productSales = await Invoice.aggregate([{
                $match: {
                    status: 'paid',
                    createdAt: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.name',
                    totalQuantity: { $sum: '$products.quantity' },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$products.price', '$products.quantity']
                        }
                    },
                    averagePrice: { $avg: '$products.price' }
                }
            },
            {
                $project: {
                    _id: 0,
                    productName: '$_id',
                    totalQuantity: 1,
                    totalRevenue: 1,
                    averagePrice: 1
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.status(200).json({
            success: true,
            body: productSales
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating product sales report',
            error: error.message
        });
    }
};

// Get Yearly Sales Report
const getYearlySales = async(req, res) => {
    try {
        const yearlySales = await Invoice.aggregate([
            { $match: { status: 'paid' } },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' } },
                    totalRevenue: { $sum: '$totalAmount' },
                    totalInvoices: { $sum: 1 },
                    averageInvoiceValue: { $avg: '$totalAmount' },
                    // Additional product-level aggregations
                    totalProducts: {
                        $sum: { $size: '$products' }
                    },
                    totalQuantitySold: {
                        $sum: {
                            $reduce: {
                                input: '$products',
                                initialValue: 0,
                                in: { $add: ['$$value', '$$this.quantity'] }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    year: '$_id.year',
                    totalRevenue: 1,
                    totalInvoices: 1,
                    averageInvoiceValue: 1,
                    totalProducts: 1,
                    totalQuantitySold: 1,
                    averageRevenuePerProduct: {
                        $divide: ['$totalRevenue', '$totalProducts']
                    }
                }
            },
            { $sort: { year: 1 } }
        ]);

        res.status(200).json({
            success: true,
            body: yearlySales
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating yearly sales report',
            error: error.message
        });
    }
};

module.exports = {
    getSalesByPrice,
    getSalesByQuantity,
    getDailySalesForMonth,
    getProductSalesForMonth,
    getYearlySales
};