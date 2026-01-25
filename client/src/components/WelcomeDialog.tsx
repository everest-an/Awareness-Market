import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<"creator" | "consumer" | null>(null);
  const utils = trpc.useUtils();

  const updateRoleMutation = trpc.user.updateUserRole.useMutation({
    onSuccess: () => {
      toast({
        title: "Welcome aboard!",
        description: "Your profile has been set up successfully.",
      });
      utils.user.me.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRoleSelect = (role: "creator" | "consumer") => {
    setSelectedRole(role);
  };

  const handleContinue = () => {
    if (selectedRole) {
      updateRoleMutation.mutate({ userType: selectedRole });
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
            The first marketplace for trading AI capabilities, reasoning states, and solution processes.
            <br />
            Let's get you started in 3 quick steps.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-center mb-4">
            What brings you here today?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Creator Card */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedRole === "creator"
                  ? "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-950"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              onClick={() => handleRoleSelect("creator")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">I'm a Creator</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      I want to publish and monetize my AI capabilities, reasoning states, or
                      solution processes.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 text-xs rounded">
                      Upload
                    </span>
                    <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 text-xs rounded">
                      Earn Revenue
                    </span>
                    <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 text-xs rounded">
                      Share Knowledge
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consumer Card */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedRole === "consumer"
                  ? "ring-2 ring-cyan-500 bg-cyan-50 dark:bg-cyan-950"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              onClick={() => handleRoleSelect("consumer")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">I'm a Consumer</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      I want to discover and integrate pre-trained AI capabilities into my
                      applications.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                      Browse
                    </span>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                      Purchase
                    </span>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                      Integrate
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              onClick={handleContinue}
              disabled={!selectedRole || updateRoleMutation.isPending}
              size="lg"
              className="w-full md:w-auto"
            >
              {updateRoleMutation.isPending ? "Setting up..." : "Continue"}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500 mt-4">
            Don't worry, you can change this later in your profile settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
