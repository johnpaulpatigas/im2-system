// backend/controllers/userController.js
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const AppError = require("../utils/appError");
const { setTokenCookie } = require("../utils/jwt");

exports.getProfile = async (req, res, next) => {
  try {
    const users = await db.query(
      "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!users || users.length === 0) {
      return next(new AppError("User not found.", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        user: users[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
      return next(new AppError("First name and last name are required.", 400));
    }

    await db.query(
      "UPDATE users SET first_name = ?, last_name = ? WHERE id = ?",
      [firstName, lastName, req.user.id],
    );

    const users = await db.query(
      "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
      [req.user.id],
    );

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully!",
      data: {
        user: users[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return next(new AppError("Please provide all password fields.", 400));
    }
    if (newPassword !== confirmNewPassword) {
      return next(new AppError("New passwords do not match.", 400));
    }
    if (newPassword.length < 8) {
      return next(
        new AppError("New password must be at least 8 characters long.", 400),
      );
    }

    const users = await db.query("SELECT * FROM users WHERE id = ?", [
      req.user.id,
    ]);

    if (!users || users.length === 0 || !users[0].password) {
      return next(
        new AppError(
          "User not found or no password set. Cannot change password.",
          404,
        ),
      );
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return next(new AppError("Current password is incorrect.", 401));
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedNewPassword,
      req.user.id,
    ]);

    const token = setTokenCookie(user, res);

    res.status(200).json({
      status: "success",
      message: "Password changed successfully!",
      token,
    });
  } catch (err) {
    next(err);
  }
};
