const { StatusCodes } = require('http-status-codes');
const errorHandlerMiddleware = (err, req, res, next) => {
	let customError = {
		statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
		msg: err.message || 'Something went wrong, please try again later',
	};

	// Handle validation errors
	if (err.name === 'ValidationError') {
		customError.msg = Object.values(err.errors)
			.map((item) => item.message)
			.join(',');
		customError.statusCode = StatusCodes.BAD_REQUEST;
	}

	// Handle duplicate key errors
	if (err.code && err.code === 11000) {
		customError.msg = `Duplicate value entered for ${Object.keys(
			err.keyValue
		)} field, please choose another value`;
		customError.statusCode = StatusCodes.BAD_REQUEST;
	}

	// Handle cast errors
	if (err.name === 'CastError') {
		customError.msg = `No item found with id: ${err.value}`;
		customError.statusCode = StatusCodes.NOT_FOUND;
	}

	// Handle authentication errors
	if (err.name === 'UnauthorizedError') {
		customError.msg = 'Authentication invalid, please log in again';
		customError.statusCode = StatusCodes.UNAUTHORIZED;
	}

	// Handle authorization errors
	if (err.name === 'ForbiddenError') {
		customError.msg = 'You do not have permission to access this resource';
		customError.statusCode = StatusCodes.FORBIDDEN;
	}

	// Optional: Log the error (you can implement logging to a file or service)
	console.error(err);

	return res.status(customError.statusCode).json({ msg: customError.msg });
};

module.exports = errorHandlerMiddleware;
