// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const db = require("../config/db");
const AppError = require("../utils/appError");

const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppError(
          "You are not logged in! Please log in to get access.",
          401,
        ),
      );
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    const users = await db.query("SELECT * FROM users WHERE id = ?", [
      decoded.id,
    ]);

    if (!users || users.length === 0) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401),
      );
    }

    req.user = users[0];
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token. Please log in again!", 401));
    }
    if (err.name === "TokenExpiredError") {
      return next(
        new AppError("Your token has expired! Please log in again.", 401),
      );
    }
    next(err);
  }
};

module.exports = protect;
