require('dotenv').config();
require('express-async-errors');

// express
const express = require('express');
const app = express();

// middleware
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');

// rest of the packages
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');

// database
const connectDB = require('./db/connect');

// routers (combine all routes)
const routes = require('./routes');

app.use(morgan('tiny'));
app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET));
app.use(cors());

// Test routes
app.get('/', (req, res) => {
	res.send('test-api');
});

// Use `/api` as the base prefix for all routes
app.use('/api', routes);

// 404 middleware
app.use(notFoundMiddleware);
// Error handler
app.use(errorHandlerMiddleware);

// Start server
const port = process.env.PORT || 5000;

const start = async () => {
	try {
		await connectDB(process.env.MONGO_URI);
		app.listen(port, console.log(`Server is listening on port: ${port}`));
	} catch (error) {
		console.log(error);
	}
};

start();
