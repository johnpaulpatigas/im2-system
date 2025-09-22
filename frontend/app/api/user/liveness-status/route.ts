// frontend/app/api/user/liveness-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, UserModel } from "../../auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await UserModel.findByPk(session.user.id);

    if (!user) {
      return NextResponse.json(
        { message: "User not found in NextAuth DB." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        data: {
          user: {
            livenessComplete: user.livenessComplete,
            faceDescriptor: user.faceDescriptor,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching liveness status:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
