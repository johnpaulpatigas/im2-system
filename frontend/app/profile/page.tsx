// frontend/app/profile/page.tsx
"use client";
import { BACKEND_URL } from "@/app/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ExpressUserProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  liveness_complete: boolean;
  face_descriptor: number[] | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: nextAuthSession, status: nextAuthStatus } = useSession();

  const [expressUser, setExpressUser] = useState<ExpressUserProfile | null>(
    null,
  );
  const [expressLoading, setExpressLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [livenessComplete, setLivenessComplete] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const isAuthenticatedViaNextAuth = nextAuthStatus === "authenticated";
  const isAuthenticatedViaExpress = expressUser !== null;

  useEffect(() => {
    if (nextAuthStatus === "loading") return;

    const fetchUserProfile = async () => {
      if (isAuthenticatedViaNextAuth && nextAuthSession?.user?.id) {
        try {
          const profileResponse = await fetch("/api/user/liveness-status");
          const profileData = await profileResponse.json();

          if (!profileResponse.ok || !profileData.data?.user) {
            console.error(
              "Failed to fetch liveness status:",
              profileData.message,
            );
            if (pathname !== "/auth/liveness") {
              router.push("/auth/liveness");
            }
            return;
          }

          if (!profileData.data.user.livenessComplete) {
            if (pathname !== "/auth/liveness") {
              router.push("/auth/liveness");
            }
            return;
          }

          setFirstName(nextAuthSession.user.name?.split(" ")[0] || "");
          setLastName(
            nextAuthSession.user.name?.split(" ").slice(1).join(" ") || "",
          );
          setEmail(nextAuthSession.user.email || "");
          setLivenessComplete(profileData.data.user.livenessComplete);
          setFaceDescriptor(profileData.data.user.faceDescriptor);
          setProfileError(null);
          setPasswordError(null);
        } catch (error) {
          console.error("Error fetching NextAuth user profile:", error);
          if (pathname !== "/auth/signin") {
            router.push("/auth/signin");
          }
        }
        setExpressLoading(false);
        return;
      }

      if (nextAuthStatus === "unauthenticated") {
        setExpressLoading(true);
        try {
          const response = await fetch(`${BACKEND_URL}/api/user/profile`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          const data = await response.json();

          if (!response.ok) {
            if (response.status === 401) {
              if (pathname !== "/auth/signin") {
                router.push("/auth/signin");
              }
              return;
            }
            const errorMessage =
              data.message || "Failed to fetch profile from Express.";
            setProfileError(errorMessage);
            setExpressUser(null);
            return;
          }

          setExpressUser(data.data.user);
          setFirstName(data.data.user.first_name);
          setLastName(data.data.user.last_name);
          setEmail(data.data.user.email);
          setLivenessComplete(data.data.user.liveness_complete);
          setFaceDescriptor(data.data.user.face_descriptor);
          setProfileError(null);
          setPasswordError(null);
        } catch (err: unknown) {
          let errorMessage =
            "Network error. Failed to load profile from Express.";
          if (err instanceof Error) errorMessage = err.message;
          else if (typeof err === "object" && err !== null && "message" in err)
            errorMessage = (err as { message: string }).message;
          setProfileError(errorMessage);
          setExpressUser(null);
          if (pathname !== "/auth/signin") {
            router.push("/auth/signin");
          }
        } finally {
          setExpressLoading(false);
        }
        return;
      }

      if (
        !isAuthenticatedViaNextAuth &&
        !isAuthenticatedViaExpress &&
        nextAuthStatus !== "loading"
      ) {
        if (pathname !== "/auth/signin") {
          router.push("/auth/signin");
        }
      }
    };

    fetchUserProfile();
  }, [
    nextAuthStatus,
    nextAuthSession,
    isAuthenticatedViaNextAuth,
    isAuthenticatedViaExpress,
    pathname,
    router,
  ]);

  const handleExpressProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setProfileLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName, lastName }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || "Failed to update profile.";
        setProfileError(errorMessage);
        return;
      }

      setExpressUser(data.data.user);
      setProfileSuccess("Profile updated successfully!");
    } catch (err: unknown) {
      let errorMessage = "Network error. Failed to update profile.";
      if (err instanceof Error) errorMessage = err.message;
      else if (typeof err === "object" && err !== null && "message" in err)
        errorMessage = (err as { message: string }).message;
      setProfileError(errorMessage);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleExpressChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordLoading(true);

    if (
      currentPassword === "" ||
      newPassword === "" ||
      confirmNewPassword === ""
    ) {
      setPasswordError("Please fill in all password fields.");
      setPasswordLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      setPasswordLoading(false);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/user/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || "Failed to change password.";
        setPasswordError(errorMessage);
        return;
      }

      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: unknown) {
      let errorMessage = "Network error. Failed to change password.";
      if (err instanceof Error) errorMessage = err.message;
      else if (typeof err === "object" && err !== null && "message" in err)
        errorMessage = (err as { message: string }).message;
      setProfileError(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleExpressLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: "GET",
        credentials: "include",
      });
      setExpressUser(null);
      router.push("/auth/signin");
    } catch (err) {
      console.error("Express logout failed:", err);
      alert("Failed to log out from Express. Please try again.");
    }
  };

  const handleNextAuthLogout = async () => {
    await signOut({ callbackUrl: "/auth/signin" });
  };

  const isLoadingAuthStatus = nextAuthStatus === "loading" || expressLoading;

  if (isLoadingAuthStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading authentication status...
      </div>
    );
  }

  if (!isAuthenticatedViaNextAuth && !isAuthenticatedViaExpress) {
    if (pathname !== "/auth/signin") {
      router.push("/auth/signin");
    }
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Profile</CardTitle>
          {isAuthenticatedViaNextAuth ? (
            <Button variant="outline" onClick={handleNextAuthLogout}>
              Logout (Google)
            </Button>
          ) : isAuthenticatedViaExpress ? (
            <Button variant="outline" onClick={handleExpressLogout}>
              Logout (Email/Pass)
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Update Profile</h3>
            <form className="space-y-4" onSubmit={handleExpressProfileUpdate}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    defaultValue={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isAuthenticatedViaNextAuth || profileLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    defaultValue={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isAuthenticatedViaNextAuth || profileLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={email}
                  disabled
                  className="cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                />
                <p className="text-muted-foreground text-sm">
                  Email address cannot be changed directly here.
                </p>
              </div>

              {/* LIVENESS DATA DISPLAY */}
              <div className="space-y-2">
                <Label htmlFor="livenessStatus">Liveness Status</Label>
                <Input
                  id="livenessStatus"
                  type="text"
                  value={livenessComplete ? "Complete" : "Incomplete"}
                  disabled
                  className="cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                />
              </div>
              {faceDescriptor && (
                <div className="space-y-2">
                  <Label>Face Descriptor (first 4 values)</Label>
                  <Input
                    type="text"
                    value={
                      faceDescriptor
                        .slice(0, 4)
                        .map((n) => n.toFixed(4))
                        .join(", ") + ", ..."
                    }
                    disabled
                    className="cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                  />
                </div>
              )}

              {profileError && (
                <p className="text-sm text-red-500">{profileError}</p>
              )}
              {profileSuccess && (
                <p className="text-sm text-green-500">{profileSuccess}</p>
              )}
              <Button
                type="submit"
                disabled={profileLoading || isAuthenticatedViaNextAuth}
              >
                {profileLoading ? "Saving..." : "Save Profile Changes"}
              </Button>
              {isAuthenticatedViaNextAuth && (
                <p className="text-muted-foreground text-sm">
                  Profile details for Google OAuth accounts are managed via
                  Google.
                </p>
              )}
            </form>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background text-muted-foreground px-2">
                Or
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Change Password</h3>
            <form className="space-y-4" onSubmit={handleExpressChangePassword}>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isAuthenticatedViaNextAuth || passwordLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isAuthenticatedViaNextAuth || passwordLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={isAuthenticatedViaNextAuth || passwordLoading}
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-500">{passwordSuccess}</p>
              )}
              <Button
                type="submit"
                variant="default"
                disabled={passwordLoading || isAuthenticatedViaNextAuth}
              >
                {passwordLoading ? "Changing..." : "Change Password"}
              </Button>
              {isAuthenticatedViaNextAuth && (
                <p className="text-muted-foreground text-sm">
                  Password for Google OAuth accounts is managed by Google.
                </p>
              )}
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
