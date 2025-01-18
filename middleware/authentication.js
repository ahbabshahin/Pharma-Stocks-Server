const CustomError = require('../errors');
const { isTokenValid } = require('../utils');

const authenticateUser = (req, res, next) => {
	// const token = req.signedCookies.token;
	const token = req.headers.authorization?.split(' ')[1];
	if (!token) {
		throw new CustomError.UnauthenticatedError('Authentication Invalid');
	}

	try {
		const payload = isTokenValid({ token });
		const { name, userId, role } = payload;
		req.user = { name, userId, role };
		next();
	} catch (error) {
		throw new CustomError.UnauthenticatedError('Authentication Invalid');
	}
};

const authorizePermissions = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			throw new CustomError.UnauthenticatedError(
				'Unauthorized to access this route'
			);
		}

		next();
	};
};

module.exports = {
	authenticateUser,
	authorizePermissions,
};
