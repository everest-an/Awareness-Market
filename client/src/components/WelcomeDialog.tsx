import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Terminal, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<"workspace" | "cli" | null>(null);
  const utils = trpc.useUtils();

  const updateRoleMutation = trpc.user.updateUserRole.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      onOpenChange(false);

      if (selected === "workspace") {
        navigate("/workspace/new");
      } else {
        navigate("/documentation");
      }

      toast({
        title: "Welcome aboard!",
        description: selected === "workspace"
          ? "Let's set up your AI workspace."
          : "Check out the CLI getting started guide.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleContinue = () => {
    if (selected) {
      // Set role as "creator" for developer-focused users (compatible with existing schema)
      updateRoleMutation.mutate({ userType: "creator" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-white/30" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Welcome to Awareness!</DialogTitle>
          <DialogDescription className="text-center">
            Stop re-explaining your codebase to AI.
            <br />
            Set up your multi-AI workspace in 30 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-center mb-4">
            How do you want to get started?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workspace UI Card */}
            <Card
              className={`cursor-pointer transition-all ${
                selected === "workspace"
                  ? "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-950"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              onClick={() => setSelected("workspace")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                    <Users className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Set up workspace</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Add your AI tools (Claude, Cursor, Kiro, v0...) and get MCP configs in a wizard.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 text-xs rounded">
                      Visual Setup
                    </span>
                    <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 text-xs rounded">
                      30 seconds
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CLI Card */}
            <Card
              className={`cursor-pointer transition-all ${
                selected === "cli"
                  ? "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-950"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              onClick={() => setSelected("cli")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Terminal className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Use the CLI</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Run <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">npx awareness init</code> in your project to auto-detect everything.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                      Auto-detect
                    </span>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                      Terminal
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              onClick={handleContinue}
              disabled={!selected || updateRoleMutation.isPending}
              size="lg"
              className="w-full md:w-auto"
            >
              {updateRoleMutation.isPending ? "Setting up..." : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500 mt-4">
            You can always switch methods later or explore the full platform marketplace.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
