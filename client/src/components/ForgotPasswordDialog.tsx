import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, CheckCircle2 } from "lucide-react";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "email" | "code" | "password" | "success";

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setStep("code");
      toast({
        title: "Verification code sent",
        description: "Please check your email. The code will expire in 10 minutes.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to send",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyCode = trpc.auth.verifyResetCode.useMutation({
    onSuccess: () => {
      setStep("password");
      toast({
        title: "Verification successful",
        description: "Please enter your new password",
      });
    },
    onError: (error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setStep("success");
      toast({
        title: "Password reset successful",
        description: "You can now login with your new password",
      });
    },
    onError: (error) => {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Please enter your email",
        variant: "destructive",
      });
      return;
    }
    requestReset.mutate({ email });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast({
        title: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }
    verifyCode.mutate({ email, code });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "The two passwords do not match",
        variant: "destructive",
      });
      return;
    }
    resetPassword.mutate({ email, code, newPassword });
  };

  const handleClose = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {step === "email" && "Forgot Password"}
            {step === "code" && "Enter Verification Code"}
            {step === "password" && "Set New Password"}
            {step === "success" && "Reset Successful"}
          </DialogTitle>
          <DialogDescription>
            {step === "email" && "Enter your email address to receive a verification code"}
            {step === "code" && "Enter the 6-digit code sent to your email"}
            {step === "password" && "Enter your new password"}
            {step === "success" && "Your password has been successfully reset"}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={requestReset.isPending}
                className="w-full"
              >
                {requestReset.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Code
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-code">Verification Code</Label>
              <Input
                id="reset-code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                required
              />
              <p className="text-sm text-muted-foreground">
                Code sent to {email}
              </p>
            </div>
            <DialogFooter className="flex-col gap-2">
              <Button
                type="submit"
                disabled={verifyCode.isPending}
                className="w-full"
              >
                {verifyCode.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Verify
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("email")}
                className="w-full"
              >
                Resend Code
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={resetPassword.isPending}
                className="w-full"
              >
                {resetPassword.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "success" && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <p className="text-center text-muted-foreground">
              Your password has been successfully reset. Please login with your new password.
            </p>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
