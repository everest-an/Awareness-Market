import { createContext, useContext, useEffect, ReactNode } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Bell, ShoppingCart, Sparkles, TrendingUp } from "lucide-react";

interface NotificationContextType {
  isConnected: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  isConnected: false,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket(user?.id.toString());

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Transaction notifications
    socket.on("transaction:completed", (data: {
      transactionId: number;
      vectorName: string;
      amount: number;
      buyerName?: string;
    }) => {
      toast.success("New Transaction!", {
        description: user?.role === "creator" 
          ? `${data.buyerName || "Someone"} purchased "${data.vectorName}" for $${data.amount.toFixed(2)}`
          : `You successfully purchased "${data.vectorName}"`,
        icon: <ShoppingCart className="h-4 w-4" />,
        duration: 5000,
      });
    });

    // Recommendation updates
    socket.on("recommendation:updated", (data: {
      vectorId: number;
      vectorName: string;
      reason: string;
      matchScore: number;
    }) => {
      toast.info("New Recommendation!", {
        description: `"${data.vectorName}" - ${data.reason}`,
        icon: <Sparkles className="h-4 w-4" />,
        duration: 5000,
        action: {
          label: "View",
          onClick: () => {
            window.location.href = `/vector/${data.vectorId}`;
          },
        },
      });
    });

    // Market change notifications
    socket.on("market:new-vector", (data: {
      vectorId: number;
      vectorName: string;
      category: string;
      price: number;
    }) => {
      toast("New Vector Available!", {
        description: `"${data.vectorName}" in ${data.category} - $${data.price.toFixed(2)}`,
        icon: <TrendingUp className="h-4 w-4" />,
        duration: 5000,
        action: {
          label: "Explore",
          onClick: () => {
            window.location.href = `/vector/${data.vectorId}`;
          },
        },
      });
    });

    // Review notifications (for creators)
    socket.on("review:new", (data: {
      vectorId: number;
      vectorName: string;
      rating: number;
      reviewerName?: string;
    }) => {
      if (user?.role === "creator") {
        toast(`New ${data.rating}⭐ Review!`, {
          description: `${data.reviewerName || "Someone"} reviewed "${data.vectorName}"`,
          icon: <Bell className="h-4 w-4" />,
          duration: 5000,
          action: {
            label: "View",
            onClick: () => {
              window.location.href = `/vector/${data.vectorId}`;
            },
          },
        });
      }
    });

    // General notifications
    socket.on("notification", (data: {
      title: string;
      message: string;
      type?: "info" | "success" | "warning" | "error";
    }) => {
      const toastFn = data.type === "success" ? toast.success
        : data.type === "error" ? toast.error
        : data.type === "warning" ? toast.warning
        : toast.info;
      
      toastFn(data.title, {
        description: data.message,
        duration: 5000,
      });
    });

    return () => {
      socket.off("transaction:completed");
      socket.off("recommendation:updated");
      socket.off("market:new-vector");
      socket.off("review:new");
      socket.off("notification");
    };
  }, [socket, user]);

  return (
    <NotificationContext.Provider value={{ isConnected }}>
      {children}
    </NotificationContext.Provider>
  );
}
