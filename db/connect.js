const mongoose = require('mongoose');

const connectDB = async (url) => {
	try {
		await mongoose.connect(url);
		console.log('Database connection successful');
	} catch (error) {
		console.error('Database connection error:', error);
		process.exit(1); // Exit process with failure
	}
};

module.exports = connectDB;
