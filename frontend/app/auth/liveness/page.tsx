// frontend/app/auth/liveness/page.tsx
"use client";
import { BACKEND_URL } from "@/app/config";
import { signOut, useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const DynamicLivenessChecker = dynamic(
  () =>
    import("@/components/LivenessChecker").then((mod) => mod.LivenessChecker),
  {
    ssr: false,
    loading: () => <p>Loading Liveness Checker...</p>,
  },
);

interface UserLivenessData {
  livenessComplete: boolean;
  faceDescriptor: number[] | null;
}

export default function LivenessPage() {
  const router = useRouter();
  const { data: nextAuthSession, status: nextAuthStatus } = useSession();

  const [isAuthenticatedViaNextAuth, setIsAuthenticatedViaNextAuth] =
    useState(false);
  const [livenessData, setLivenessData] = useState<UserLivenessData | null>(
    null,
  );
  const [loadingUserStatus, setLoadingUserStatus] = useState(true);

  const performLogout = async () => {
    if (isAuthenticatedViaNextAuth) {
      await signOut({ redirect: false });
    } else {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "GET",
          credentials: "include",
        });
      } catch (err) {
        console.error("Express logout failed after liveness failure:", err);
      }
    }
    router.push("/auth/signin?error=liveness_failed");
  };

  useEffect(() => {
    const checkUserAndLivenessStatus = async () => {
      if (nextAuthStatus === "loading") return;

      let authViaNextAuth = false;
      let userLivenessData: UserLivenessData | null = null;
      let isAuthenticated = false;

      if (nextAuthStatus === "authenticated" && nextAuthSession?.user?.id) {
        authViaNextAuth = true;
        isAuthenticated = true;

        try {
          const profileResponse = await fetch("/api/user/liveness-status");
          const profileData = await profileResponse.json();

          if (profileResponse.ok && profileData.data?.user) {
            userLivenessData = {
              livenessComplete: profileData.data.user.livenessComplete,
              faceDescriptor: profileData.data.user.faceDescriptor,
            };
          } else {
            console.error(
              "Failed to fetch NextAuth user liveness status:",
              profileData.message,
            );
            userLivenessData = {
              livenessComplete: false,
              faceDescriptor: null,
            };
          }
        } catch (err) {
          console.error(
            "Network error fetching NextAuth user liveness status:",
            err,
          );
          userLivenessData = { livenessComplete: false, faceDescriptor: null };
        }
      } else if (nextAuthStatus === "unauthenticated") {
        try {
          const response = await fetch(`${BACKEND_URL}/api/user/profile`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          const data = await response.json();

          if (response.ok && data.data?.user) {
            isAuthenticated = true;
            userLivenessData = {
              livenessComplete: data.data.user.liveness_complete,
              faceDescriptor: data.data.user.face_descriptor,
            };
          } else {
            console.error(
              "Failed to fetch Express profile for liveness check:",
              data.message,
            );
          }
        } catch (err: unknown) {
          console.error("Network error fetching Express profile:", err);
        }
      }

      if (!isAuthenticated) {
        router.push("/auth/signin");
        return;
      }

      setIsAuthenticatedViaNextAuth(authViaNextAuth);
      setLivenessData(userLivenessData);
      setLoadingUserStatus(false);
    };

    checkUserAndLivenessStatus();
  }, [router, nextAuthSession, nextAuthStatus]);

  const handleLivenessSuccess = async (currentFaceDescriptor: number[]) => {
    console.log(
      "Liveness check succeeded! Proceeding to face matching/saving...",
    );
    if (!livenessData?.livenessComplete) {
      try {
        let response;
        if (isAuthenticatedViaNextAuth) {
          response = await fetch("/api/user/liveness-data", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ faceDescriptor: currentFaceDescriptor }),
          });
        } else {
          response = await fetch(`${BACKEND_URL}/api/user/liveness-data`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ faceDescriptor: currentFaceDescriptor }),
          });
        }

        const data = await response.json();
        if (!response.ok) {
          console.error("Failed to save liveness data:", data.message);
          performLogout();
          return;
        }
        console.log("Initial liveness data saved. Redirecting to profile.");
        router.push("/profile");
      } catch (err: unknown) {
        console.error("Network error while saving initial liveness data:", err);
        performLogout();
      }
    } else {
      if (!livenessData.faceDescriptor) {
        console.error(
          "User has livenessComplete=true but no faceDescriptor stored.",
        );
        performLogout();
        return;
      }
      try {
        let response;
        if (isAuthenticatedViaNextAuth) {
          response = await fetch("/api/user/verify-face-match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentFaceDescriptor }),
          });
        } else {
          response = await fetch(`${BACKEND_URL}/api/user/verify-face-match`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ currentFaceDescriptor }),
          });
        }

        const data = await response.json();
        if (!response.ok || !data.data.isMatch) {
          console.error(
            "Face matching failed:",
            data.message || "Match not found.",
          );
          performLogout();
          return;
        }
        console.log("Face matched successfully! Redirecting to profile.");
        router.push("/profile");
      } catch (err: unknown) {
        console.error("Network error while verifying face match:", err);
        performLogout();
      }
    }
  };

  const handleLivenessFailure = (error: { code: string; message: string }) => {
    console.error("Liveness check failed:", error);
    performLogout();
  };

  if (
    loadingUserStatus ||
    nextAuthStatus === "loading" ||
    livenessData === null
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Checking authentication and liveness status...
      </div>
    );
  }

  if (!nextAuthSession && !livenessData) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-2xl">
        <h2 className="mb-6 text-center text-3xl font-bold">
          {livenessData?.livenessComplete
            ? "Verify Your Identity"
            : "Complete Liveness Check"}
        </h2>
        <Suspense fallback={<p>Loading Liveness Checker...</p>}>
          <DynamicLivenessChecker
            onLivenessSuccess={handleLivenessSuccess}
            onLivenessFailure={handleLivenessFailure}
          />
        </Suspense>
      </div>
    </div>
  );
}
