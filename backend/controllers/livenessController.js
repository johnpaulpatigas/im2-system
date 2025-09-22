// backend/controllers/livenessController.js
const db = require("../config/db");
const AppError = require("../utils/appError");

function calculateEuclideanDistance(descriptor1, descriptor2) {
  if (
    !descriptor1 ||
    !descriptor2 ||
    descriptor1.length !== descriptor2.length
  ) {
    throw new Error("Invalid descriptors for comparison.");
  }
  let sumOfSquares = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    sumOfSquares += Math.pow(descriptor1[i] - descriptor2[i], 2);
  }
  return Math.sqrt(sumOfSquares);
}

const FACE_MATCH_THRESHOLD = 0.6;

exports.saveLivenessData = async (req, res, next) => {
  try {
    const { faceDescriptor } = req.body;

    if (
      !faceDescriptor ||
      !Array.isArray(faceDescriptor) ||
      faceDescriptor.length === 0
    ) {
      return next(new AppError("Valid face descriptor is required.", 400));
    }

    await db.query(
      "UPDATE users SET liveness_complete = TRUE, face_descriptor = ? WHERE id = ?",
      [JSON.stringify(faceDescriptor), req.user.id],
    );

    const users = await db.query(
      "SELECT id, first_name, last_name, email, liveness_complete, face_descriptor FROM users WHERE id = ?",
      [req.user.id],
    );

    res.status(200).json({
      status: "success",
      message: "Liveness data saved successfully!",
      data: { user: users[0] },
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyFaceMatch = async (req, res, next) => {
  try {
    const { currentFaceDescriptor } = req.body;

    if (
      !currentFaceDescriptor ||
      !Array.isArray(currentFaceDescriptor) ||
      currentFaceDescriptor.length === 0
    ) {
      return next(
        new AppError(
          "Current face descriptor is required for verification.",
          400,
        ),
      );
    }

    const users = await db.query(
      "SELECT id, face_descriptor, liveness_complete FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!users || users.length === 0) {
      return next(new AppError("User not found.", 404));
    }

    const user = users[0];

    if (!user.liveness_complete || !user.face_descriptor) {
      return next(
        new AppError(
          "User has not completed liveness check or no face descriptor is stored.",
          403,
        ),
      );
    }

    const storedFaceDescriptor = user.face_descriptor;

    if (
      !Array.isArray(storedFaceDescriptor) ||
      storedFaceDescriptor.length !== currentFaceDescriptor.length
    ) {
      return next(
        new AppError(
          "Stored and current face descriptors are incompatible.",
          400,
        ),
      );
    }

    const distance = calculateEuclideanDistance(
      storedFaceDescriptor,
      currentFaceDescriptor,
    );

    const isMatch = distance < FACE_MATCH_THRESHOLD;

    res.status(200).json({
      status: "success",
      data: {
        isMatch,
        distance: distance.toFixed(4),
        threshold: FACE_MATCH_THRESHOLD,
      },
      message: isMatch
        ? "Face matched successfully."
        : "Face did not match stored descriptor.",
    });
  } catch (err) {
    console.error("Error during face matching:", err);
    next(new AppError("Face matching failed due to an internal error.", 500));
  }
};
