const Invoice = require('../models/Invoice');

const getSalesByPrice = async(req, res) => {
    try {
        const { date } = req.query;
        if (!date || !Date.parse(date)) {
            return res.status(400).json({
                success: false,
                message: 'Valid date parameter is required (YYYY-MM-DD format)',
            });
        }

        // Create start and end dates for the month
        const startDate = new Date(date);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);

        const salesByProduct = await Invoice.aggregate([{
                $match: {
                    status: 'paid',
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate,
                    },
                },
            },
            { $unwind: '$products' },
            {
                $group: {
                    _id: { name: '$products.name', price: '$products.price' },
                    totalQuantity: { $sum: '$products.quantity' },
                    grossRevenue: {
                        $sum: {
                            $multiply: [
                                '$products.price',
                                '$products.quantity',
                            ],
                        },
                    }, // Revenue before discount
                    totalDiscount: {
                        $sum: {
                            $multiply: [
                                '$discount',
                                {
                                    $divide: [{
                                            $multiply: [
                                                '$products.price',
                                                '$products.quantity'
                                            ]
                                        },
                                        100,
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    product: '$_id.name',
                    price: '$_id.price',
                    totalQuantity: 1,
                    totalRevenue: {
                        $subtract: ['$grossRevenue', '$totalDiscount'],
                    }, // Deduct discount
                },
            },
            { $sort: { totalRevenue: -1 } },
        ]);

        // Calculate total revenue for the month after discount
        const totalRevenueForMonth = salesByProduct.reduce(
            (acc, item) => acc + item.totalRevenue,
            0
        );

        res.status(200).json({
            success: true,
            body: salesByProduct.map((item) => ({
                product: item.product,
                price: item.price,
                totalQuantity: item.totalQuantity,
                totalRevenue: item.totalRevenue,
                month: startDate.toLocaleString('default', { month: 'long' }),
                year: startDate.getFullYear(),
            })),
            total: totalRevenueForMonth, // Include total revenue after discount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating sales by product report',
            error: error.message,
        });
    }
};


// Get Sales Report by Quantity
const getSalesByQuantity = async(req, res) => {
    try {
        const { date } = req.query;
        if (!date || !Date.parse(date)) {
            return res.status(400).json({
                success: false,
                message: 'Valid date parameter is required (YYYY-MM-DD format)',
            });
        }

        // Parse the input date
        const targetDate = new Date(date);
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

        const salesByQuantity = await Invoice.aggregate([{
                $match: {
                    status: 'paid',
                    createdAt: {
                        $gte: startOfMonth,
                        $lte: endOfMonth,
                    },
                },
            },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.name',
                    totalQuantity: { $sum: '$products.quantity' },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$products.price', '$products.quantity'],
                        },
                    },
                    averagePrice: { $avg: '$products.price' },
                },
            },
            { $sort: { totalQuantity: -1 } },
        ]);

        // Calculate total quantity sold across all products
        const totalQuantitySold = salesByQuantity.reduce((acc, item) => acc + item.totalQuantity, 0);

        // Map the response to include product name under the key 'product'
        const responseBody = salesByQuantity.map(item => ({
            product: item._id, // Set product name here
            totalQuantity: item.totalQuantity,
            totalRevenue: item.totalRevenue,
            averagePrice: item.averagePrice,
        }));

        res.status(200).json({
            success: true,
            body: responseBody,
            total: totalQuantitySold, // Include total quantity in the response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating sales by quantity report',
            error: error.message,
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
                    totalQuantity: { $sum: { $sum: '$products.quantity' } }, // Total quantity of products sold
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
                    totalQuantity: 1,
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

        // Calculate total revenue for the month
        const totalMonthlyRevenue = dailySales.reduce((acc, day) => acc + day.totalRevenue, 0);
        const totalMonthlyProductSale = dailySales.reduce(
            (acc, day) => acc + day.totalQuantity,
            0
        );

        res.status(200).json({
            success: true,
            body: dailySales,
            total: totalMonthlyRevenue, // Include total revenue for the month
            totalQuantity: totalMonthlyProductSale, // Include total quantity sold for the month
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
        const { year } = req.query;
        if (!year || isNaN(year)) {
            return res.status(400).json({
                success: false,
                message: 'Valid year parameter is required (YYYY format)',
            });
        }

        const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
        const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

        const monthlySales = await Invoice.aggregate([{
                $match: {
                    status: 'paid',
                    createdAt: {
                        $gte: startOfYear,
                        $lte: endOfYear,
                    },
                },
            },
            {
                $group: {
                    _id: { month: { $month: '$createdAt' } },
                    totalRevenue: { $sum: '$totalAmount' },
                    totalQuantitySold: {
                        $sum: {
                            $reduce: {
                                input: '$products',
                                initialValue: 0,
                                in: { $add: ['$$value', '$$this.quantity'] },
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    month: '$_id.month',
                    totalRevenue: 1,
                    totalQuantitySold: 1,
                },
            },
            { $sort: { month: 1 } },
        ]);

        // Calculate total revenue and total quantity for the year
        const totalRevenueForYear = monthlySales.reduce(
            (acc, item) => acc + item.totalRevenue,
            0
        );
        const totalQuantityForYear = monthlySales.reduce(
            (acc, item) => acc + item.totalQuantitySold,
            0
        );

        res.status(200).json({
            success: true,
            body: monthlySales.map((item) => ({
                month: new Date(year, item.month - 1, 1).toLocaleString(
                    'default', { month: 'long' }
                ),
                totalRevenue: item.totalRevenue,
                totalQuantity: item.totalQuantitySold,
            })),
            totalRevenue: totalRevenueForYear,
            totalQuantitySold: totalQuantityForYear,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating yearly sales report',
            error: error.message,
        });
    }
};


const getDailySoldProductForMonth = async(req, res) => {
    try {
        const { date } = req.query;
        if (!date || !Date.parse(date)) {
            return res.status(400).json({
                success: false,
                message: 'Valid date parameter is required (YYYY-MM-DD format)',
            });
        }

        // Parse the input date
        const targetDate = new Date(date);
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

        // Get daily sold quantities
        const dailySales = await Invoice.aggregate([{
                $match: {
                    status: 'paid',
                    createdAt: {
                        $gte: startOfMonth,
                        $lte: endOfMonth,
                    },
                },
            },
            { $unwind: '$products' },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                        productName: '$products.name',
                    },
                    totalQuantity: { $sum: '$products.quantity' },
                },
            },
            {
                $group: {
                    _id: { year: '$_id.year', month: '$_id.month', day: '$_id.day' },
                    products: {
                        $push: {
                            productName: '$_id.productName',
                            totalQuantity: '$totalQuantity',
                        },
                    },
                    totalQuantityForDay: { $sum: '$totalQuantity' },
                },
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: {
                                $dateFromParts: {
                                    year: '$_id.year',
                                    month: '$_id.month',
                                    day: '$_id.day',
                                },
                            },
                        },
                    },
                    products: 1,
                    totalQuantityForDay: 1,
                },
            },
            { $sort: { date: 1 } },
        ]);

        // Calculate total quantity sold for the month
        const totalQuantitySoldForMonth = dailySales.reduce((acc, day) => acc + day.totalQuantityForDay, 0);

        res.status(200).json({
            success: true,
            body: dailySales,
            total: totalQuantitySoldForMonth, // Include total quantity sold for the month
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating daily sold product report for the month',
            error: error.message,
        });
    }
};

module.exports = {
    getSalesByPrice,
    getSalesByQuantity,
    getDailySalesForMonth,
    getProductSalesForMonth,
    getYearlySales,
    getDailySoldProductForMonth,
};