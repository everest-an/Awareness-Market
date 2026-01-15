import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

/**
 * Hook to manage Socket.IO connection
 * Automatically connects/disconnects based on component lifecycle
 */
export function useSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only connect if we have a userId
    if (!userId) {
      return;
    }

    // Create socket connection
    const socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on("connect", () => {
      console.log("[Socket.IO] Connected:", socket.id);
      setIsConnected(true);
      
      // Join user-specific room
      socket.emit("join", userId);
    });

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.warn("[Socket.IO] Connection error:", error.message);
      // Gracefully handle connection errors - notifications will still work via polling
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [userId]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
