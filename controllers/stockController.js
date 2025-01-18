const Stock = require('../models/Stock');
const CustomError = require('../errors');

// Create a new product
const createProduct = async (req, res) => {
	const { name, quantity, price, dosage } =
		req.body;

	try {
		const newProduct = new Stock(req?.body);

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
const getAllProducts = async (req, res) => {
	const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10

	try {
		const skip = (page - 1) * limit; // Calculate how many records to skip
		const totalProducts = await Stock.countDocuments(); // Get total number of products
		const products = await Stock.find()
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 }); // Sort by creation date, descending

		res.status(200).json({
			total: totalProducts,
			totalPages: Math.ceil(totalProducts / limit),
			currentPage: Number(page),
			body: products,
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error });
	}
};

// Get product by ID
const getProductById = async (req, res) => {
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

const updateProduct = async (req, res) => {
	const { productId } = req.params;
	const updates = req.body; // The fields to update

	try {
		// Find the product by ID
		const product = await Stock.findById(productId);

		if (!product) {
			return res.status(404).json({ message: 'Product not found' });
		}

		// Update product fields dynamically
		Object.keys(updates).forEach((key) => {
			if (key in product) {
				product[key] = updates[key];
			}
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
const updateProductStock = async (req, res) => {
	const { productId } = req.params;
	const { soldQuantity, returnedQuantity } = req.body;

	try {
		const product = await Stock.findById(productId);
		if (!product) {
			return res.status(404).json({ message: 'Product not found' });
		}

		if (soldQuantity) {
			product.quantity -= soldQuantity;
		}

		if (returnedQuantity) {
			product.quantity += returnedQuantity;
		}

		// Ensure stock does not fall below zero
		if (product.quantity < 0) {
			product.quantity = 0;
		}

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
const deleteProduct = async (req, res) => {
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
const updateStockForStore = async (req, res) => {
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

const searchStock = async (req, res) => {
	const { query, quantity, price, } = req.query; // Get the search query and additional filters from query parameters

	// Build the search criteria
	const searchCriteria = {
		$or: [],
	};

	if (query) {
		searchCriteria.$or.push(
			{ name: { $regex: query, $options: 'i' } },
			{ dosage: { $regex: query, $options: 'i' } },
			{ brand: { $regex: query, $options: 'i' } }
		);
	}

	if (quantity) {
		searchCriteria.quantity = quantity; // Filter by quantity
	}

	if (price) {
		searchCriteria.price = price; // Filter by price
	}

	try {
		const products = await Stock.find(searchCriteria);

		if (products.length === 0) {
			return res.status(404).json({ message: 'No products found' });
		}

		res.status(200).json({
			body: products,
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
