// backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const db = require("../config/db");
const AppError = require("../utils/appError");
const { setTokenCookie } = require("../utils/jwt");

const randomBytesPromisified = promisify(randomBytes);

exports.signup = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return next(new AppError("Please provide all required fields.", 400));
    }
    if (password !== confirmPassword) {
      return next(new AppError("Passwords do not match.", 400));
    }
    if (password.length < 8) {
      return next(
        new AppError("Password must be at least 8 characters long.", 400),
      );
    }

    const existingUsers = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return next(new AppError("User with that email already exists.", 409));
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const rawRecoveryKey = (await randomBytesPromisified(24)).toString("hex");
    const hashedRecoveryKey = await bcrypt.hash(rawRecoveryKey, 12);

    const result = await db.query(
      "INSERT INTO users (first_name, last_name, email, password, recovery_key_hash) VALUES (?, ?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword, hashedRecoveryKey],
    );

    const newUserRows = await db.query(
      "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
      [result.insertId],
    );
    const newUser = newUserRows[0];

    const token = setTokenCookie(newUser, res);

    res.status(201).json({
      status: "success",
      token,
      data: {
        user: newUser,
        recoveryKey: rawRecoveryKey,
      },
      message: "Account created successfully. PLEASE SAVE YOUR RECOVERY KEY!",
    });
  } catch (err) {
    next(err);
  }
};

exports.signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Please provide email and password!", 400));
    }

    const users = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!users || users.length === 0 || !users[0].password) {
      return next(new AppError("Incorrect email or password", 401));
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return next(new AppError("Incorrect email or password", 401));
    }

    const token = setTokenCookie(user, res);

    res.status(200).json({
      status: "success",
      token,
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyRecoveryKey = async (req, res, next) => {
  try {
    const { email, recoveryKey } = req.body;

    if (!email || !recoveryKey) {
      return next(new AppError("Please provide email and recovery key.", 400));
    }

    const users = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!users || users.length === 0 || !users[0].recovery_key_hash) {
      return next(new AppError("Invalid email or recovery key.", 401));
    }

    const user = users[0];

    const isKeyMatch = await bcrypt.compare(
      recoveryKey,
      user.recovery_key_hash,
    );

    if (!isKeyMatch) {
      return next(new AppError("Invalid email or recovery key.", 401));
    }

    res.status(200).json({
      status: "success",
      message: "Recovery key verified. You can now reset your password.",
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, recoveryKey, newPassword, confirmNewPassword } = req.body;

    if (!email || !recoveryKey || !newPassword || !confirmNewPassword) {
      return next(
        new AppError(
          "Please provide all required fields (email, recovery key, new password, confirmation).",
          400,
        ),
      );
    }
    if (newPassword !== confirmNewPassword) {
      return next(new AppError("Passwords do not match.", 400));
    }
    if (newPassword.length < 8) {
      return next(
        new AppError("Password must be at least 8 characters long.", 400),
      );
    }

    const users = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!users || users.length === 0 || !users[0].recovery_key_hash) {
      return next(new AppError("Invalid email or recovery key.", 401));
    }

    const user = users[0];
    const isKeyMatch = await bcrypt.compare(
      recoveryKey,
      user.recovery_key_hash,
    );

    if (!isKeyMatch) {
      return next(new AppError("Invalid email or recovery key.", 401));
    }

    user.password = await bcrypt.hash(newPassword, 12);

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      user.password,
      user.id,
    ]);

    const token = setTokenCookie(user, res);

    res.status(200).json({
      status: "success",
      message: "Password reset successfully!",
      token,
      data: {
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
};
