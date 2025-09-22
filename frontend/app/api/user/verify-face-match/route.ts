// frontend/app/api/user/verify-face-match/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, UserModel } from "../../auth/[...nextauth]/route";

function calculateEuclideanDistance(
  descriptor1: number[],
  descriptor2: number[],
): number {
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { currentFaceDescriptor } = await req.json();

  if (
    !currentFaceDescriptor ||
    !Array.isArray(currentFaceDescriptor) ||
    currentFaceDescriptor.length === 0
  ) {
    return NextResponse.json(
      { message: "Current face descriptor is required for verification." },
      { status: 400 },
    );
  }

  try {
    const user = await UserModel.findByPk(session.user.id);

    if (!user) {
      return NextResponse.json(
        { message: "User not found in NextAuth DB." },
        { status: 404 },
      );
    }

    if (!user.livenessComplete || !user.faceDescriptor) {
      return NextResponse.json(
        {
          message:
            "User has not completed liveness check or no face descriptor is stored.",
        },
        { status: 403 },
      );
    }

    const storedFaceDescriptor = user.faceDescriptor;

    if (
      !Array.isArray(storedFaceDescriptor) ||
      storedFaceDescriptor.length !== currentFaceDescriptor.length
    ) {
      return NextResponse.json(
        { message: "Stored and current face descriptors are incompatible." },
        { status: 400 },
      );
    }

    const distance = calculateEuclideanDistance(
      storedFaceDescriptor,
      currentFaceDescriptor,
    );
    const isMatch = distance < FACE_MATCH_THRESHOLD;

    return NextResponse.json(
      {
        status: "success",
        data: {
          isMatch,
          distance: distance.toFixed(4),
          threshold: FACE_MATCH_THRESHOLD,
        },
        message: isMatch
          ? "Face matched successfully."
          : "Face did not match stored descriptor.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error during face matching for NextAuth user:", error);
    return NextResponse.json(
      { message: "Internal server error during face matching." },
      { status: 500 },
    );
  }
}
