// src/app/auth/forgot-password/page.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Enter your email address below and we&apos;ll send you a link to
            reset your password.
          </p>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@email.com"
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Send Reset Link
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
