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
        title: "验证码已发送",
        description: "请检查您的邮箱，验证码将在10分钟后过期",
      });
    },
    onError: (error) => {
      toast({
        title: "发送失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyCode = trpc.auth.verifyResetCode.useMutation({
    onSuccess: () => {
      setStep("password");
      toast({
        title: "验证成功",
        description: "请输入新密码",
      });
    },
    onError: (error) => {
      toast({
        title: "验证失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setStep("success");
      toast({
        title: "密码重置成功",
        description: "您现在可以使用新密码登录了",
      });
    },
    onError: (error) => {
      toast({
        title: "重置失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "请输入邮箱",
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
        title: "请输入6位验证码",
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
        title: "密码太短",
        description: "密码至少需要8个字符",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "密码不匹配",
        description: "两次输入的密码不一致",
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
            {step === "email" && "忘记密码"}
            {step === "code" && "输入验证码"}
            {step === "password" && "设置新密码"}
            {step === "success" && "重置成功"}
          </DialogTitle>
          <DialogDescription>
            {step === "email" && "输入您的邮箱地址，我们将发送验证码给您"}
            {step === "code" && "请输入发送到您邮箱的6位验证码"}
            {step === "password" && "请输入您的新密码"}
            {step === "success" && "您的密码已成功重置"}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">邮箱地址</Label>
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
                发送验证码
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-code">验证码</Label>
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
                验证码已发送到 {email}
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
                验证
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("email")}
                className="w-full"
              >
                重新发送验证码
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  placeholder="至少8个字符"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="再次输入密码"
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
                重置密码
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
              您的密码已成功重置。请使用新密码登录。
            </p>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                关闭
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
