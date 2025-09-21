// backend/utils/jwt.js
const jwt = require("jsonwebtoken");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const setTokenCookie = (user, res) => {
  const token = signToken(user.id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  };

  res.cookie("jwt", token, cookieOptions);

  if (user.password) user.password = undefined;
  if (user.recovery_key_hash) user.recovery_key_hash = undefined;

  return token;
};

module.exports = { signToken, setTokenCookie };
