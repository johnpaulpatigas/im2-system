// app/auth/forgot-password/page.tsx
"use client";
import { BACKEND_URL } from "@/app/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/auth/verify-recovery-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, recoveryKey }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || "Failed to verify recovery key.";
        setError(errorMessage);
        return;
      }

      setSuccess("Recovery key verified! Redirecting to password reset...");

      router.push(
        `/auth/reset-password?email=${encodeURIComponent(email)}&recoveryKey=${encodeURIComponent(recoveryKey)}`,
      );
    } catch (err: unknown) {
      let errorMessage = "Network error. Please try again.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = (err as { message: string }).message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Enter your email address and your unique recovery key to reset your
            password.
          </p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recoveryKey">Recovery Key</Label>
              <Input
                id="recoveryKey"
                type="password"
                placeholder="Your unique recovery key"
                required
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                disabled={loading}
              />
              <p className="text-muted-foreground text-xs">
                This key was provided to you during signup.
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-500">{success}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify Recovery Key"}
            </Button>
          </form>

          <p className="text-sm">
            <Link
              href="/auth/signin"
              className="text-blue-500 hover:text-blue-700"
            >
              Back to Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
