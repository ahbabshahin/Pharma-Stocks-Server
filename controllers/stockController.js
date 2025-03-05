const Stock = require('../models/Stock');
const CustomError = require('../errors');

// Create a new product
const createProduct = async(req, res) => {
    const { name, quantity, price, dosage } =
    req.body;

    try {
        const newProduct = new Stock(req.body);

        // Add activity log entry for product creation
        newProduct.activity_log.push({
            user: req.user.userId, // Assuming user info is available in req.user
            name: req.user.name,
            when: new Date(),
            action: 'CREATE',
            description: `Product "${name}" created with quantity ${quantity} and price ${price}`,
        });

        await newProduct.save();
        res.status(201).json({
            message: 'Product created successfully',
            body: newProduct,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get all products with pagination
const getAllProducts = async(req, res) => {
    try {
        // Parse and validate page and limit
        const page = parseInt(req.query.page, 10) || 1; // Default to page 1
        const limit = parseInt(req.query.limit, 10) || 10; // Default to limit 10
        const skip = (page - 1) * limit; // Calculate skip value

        // Fetch total products and paginated products
        const totalProducts = await Stock.countDocuments();
        const products = await Stock.find()
            .skip(skip)
            .limit(limit)
            .sort({ _id: 1 }); // Sort by _id to ensure consistency

        // Respond with paginated data
        res.status(200).json({
            total: totalProducts,
            totalPages: Math.ceil(totalProducts / limit),
            currentPage: page,
            body: products,
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};


// Get product by ID
const getProductById = async(req, res) => {
    const { productId } = req.params;

    try {
        const product = await Stock.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ product });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

const updateProduct = async(req, res) => {
    const { productId } = req.params;
    const updates = req.body; // The fields to update

    try {
        // Find the product by ID
        const product = await Stock.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Store old values for activity log
        const oldValues = {...product.toObject() };

        // Update product fields dynamically
        Object.keys(updates).forEach((key) => {
            if (key in product) {
                product[key] = updates[key];
            }
        });

        // Add activity log entry for product update
        const changes = Object.keys(updates).map(key => {
            if (key === '_id') return null;
            if (oldValues[key] !== updates[key]) {
                return `${key} from "${oldValues[key]}" to "${updates[key]}"`;
            }
            return null;
        }).filter(change => change !== null);

        product.activity_log.push({
            user: req.user.userId,
            name: req.user.name,
            when: new Date(),
            action: 'UPDATE',
            description: `Product "${product.name}" updated. Changes: ${changes.join(', ')}`
        });

        await product.save();

        res.status(200).json({
            message: 'Product updated successfully',
            body: product,
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res
                .status(400)
                .json({ message: 'Invalid data provided', error });
        }
        res.status(500).json({ message: 'Server error', error });
    }
};

// Update product stock (e.g., after a sale or return)
const updateProductStock = async(req, res) => {
    const { productId } = req.params;
    const { soldQuantity, returnedQuantity } = req.body;

    try {
        const product = await Stock.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const oldQuantity = product.quantity;
        let description = `Stock quantity changed from ${oldQuantity}`;

        if (soldQuantity) {
            product.quantity -= soldQuantity;
            description += ` (Sold: ${soldQuantity})`;
        }

        if (returnedQuantity) {
            product.quantity += returnedQuantity;
            description += ` (Returned: ${returnedQuantity})`;
        }

        // Ensure stock does not fall below zero
        if (product.quantity < 0) {
            description += ` (Adjusted to 0 from ${product.quantity})`;
            product.quantity = 0;
        }

        description += ` to ${product.quantity}`;

        // Add activity log entry for stock update
        product.activity_log.push({
            user: req.user.userId,
            name: req.user.name,
            when: new Date(),
            action: 'STOCK_UPDATE',
            description
        });

        await product.save();
        res.status(200).json({
            message: 'Stock updated successfully',
            body: product,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Delete a product
const deleteProduct = async(req, res) => {
    const { productId } = req.params;

    try {
        const product = await Stock.findByIdAndDelete(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Update stock for a specific store (Admin only)
const updateStockForStore = async(req, res) => {
    const { productId, storeId } = req.params;
    const { stockLevel, lowStockThreshold } = req.body;

    try {
        const product = await Stock.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const store = product.stores.id(storeId);
        if (!store) {
            return res.status(404).json({ message: 'Store not found' });
        }

        store.stockLevel = stockLevel || store.stockLevel;
        store.lowStockThreshold = lowStockThreshold || store.lowStockThreshold;

        await product.save();
        res.status(200).json({
            message: 'Store stock updated successfully',
            body: product,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

const searchStock = async(req, res) => {
    const { query, quantity, price } = req.query; // Get the search query and additional filters

    // Build the search criteria
    const searchCriteria = {
        $or: [],
    };

    if (query) {
        searchCriteria.$or.push({ name: { $regex: query, $options: 'i' } }, { dosage: { $regex: query, $options: 'i' } }, { brand: { $regex: query, $options: 'i' } });
    }

    if (quantity) {
        searchCriteria.quantity = quantity; // Filter by quantity
    }

    if (price) {
        searchCriteria.price = price; // Filter by price
    }

    try {
        const products = await Stock.find(searchCriteria);
        const totalFound = await Stock.countDocuments(searchCriteria); // Count total matching stocks

        if (products.length === 0) {
            return res.status(404).json({ message: 'No products found', totalFound: 0 });
        }

        res.status(200).json({
            body: products,
            total: totalFound, // Include total found stocks
            message: 'Product search successful',
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};


module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    updateProductStock,
    deleteProduct,
    updateStockForStore,
    searchStock,
};