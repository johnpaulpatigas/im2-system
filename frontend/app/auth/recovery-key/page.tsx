// app/auth/recovery-key/page.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function RecoveryKeyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recoveryKey = searchParams.get("key");
  const email = searchParams.get("email");

  useEffect(() => {
    if (!recoveryKey) {
      router.replace("/auth/signup");
    }
  }, [recoveryKey, router]);

  if (!recoveryKey) {
    return null;
  }

  const handleContinue = () => {
    router.push("/auth/liveness");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Your Recovery Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Please save this key immediately and securely! You will need it to
            recover your account if you forget your password. We cannot retrieve
            this key for you.
          </p>
          <div className="relative rounded-md shadow-sm">
            <input
              id="recovery-key"
              type="text"
              readOnly
              value={recoveryKey}
              className="block w-full rounded-md bg-neutral-100 p-4 font-mono text-lg"
            />
          </div>

          <Button type="button" className="w-full" onClick={handleContinue}>
            I have saved my key, continue to Liveness Check
          </Button>

          <p className="text-muted-foreground text-sm">
            For future reference, your account email is:{" "}
            <span className="font-semibold text-black">{email || "N/A"}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
