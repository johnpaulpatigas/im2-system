// frontend/app/api/user/liveness-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, UserModel } from "../../auth/[...nextauth]/route";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { faceDescriptor } = await req.json();

  if (
    !faceDescriptor ||
    !Array.isArray(faceDescriptor) ||
    faceDescriptor.length === 0
  ) {
    return NextResponse.json(
      { message: "Valid face descriptor is required." },
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

    user.faceDescriptor = faceDescriptor;
    user.livenessComplete = true;

    await user.save();

    return NextResponse.json(
      {
        status: "success",
        message: "Liveness data saved successfully!",
        data: { user: user.toJSON() },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error saving liveness data:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
