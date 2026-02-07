/**
 * ActivityTicker - Real-time Hive Mind Activity Feed
 *
 * Displays live resonance events as they occur in the network.
 * Updates via Socket.IO for instant feedback.
 *
 * Features:
 * - Smooth scroll animations
 * - Color-coded event types
 * - Click to view details
 * - Auto-dismiss old events
 */

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { List } from "react-window";
import { trpc } from "../lib/trpc";
import { io } from "socket.io-client";

export type NetworkEvent = {
  id: string;
  consumerId: number;
  providerId: number;
  consumerName: string;
  providerName: string;
  similarity: number;
  cost: number;
  timestamp: Date;
  type: 'resonance' | 'memory_upload' | 'agent_join';
};

type ActivityTickerProps = {
  maxEvents?: number;
  className?: string;
  onEventClick?: (event: NetworkEvent) => void;
};

export function ActivityTicker({
  maxEvents = 20,
  className = "",
  onEventClick,
}: ActivityTickerProps) {
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const eventIdCounter = useRef(0);

  // Fetch recent network activity
  const { data: networkActivity } = trpc.resonance.getNetworkActivity.useQuery(
    { limit: maxEvents },
    { refetchInterval: 3000 } // Poll every 3 seconds
  );

  // Transform API data to events
  useEffect(() => {
    if (!networkActivity?.events) return;

    const newEvents = networkActivity.events.map((evt, idx) => ({
      id: `evt-${eventIdCounter.current++}`,
      consumerId: evt.consumerId,
      providerId: evt.providerId,
      consumerName: evt.consumerName,
      providerName: evt.providerName,
      similarity: evt.similarity,
      cost: evt.cost,
      timestamp: new Date(evt.timestamp),
      type: 'resonance' as const,
    }));

    setEvents(newEvents.slice(0, maxEvents));
  }, [networkActivity, maxEvents]);

  // Socket.IO listener for real-time events
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_BASE || 'http://localhost:3001');

    socket.on('resonance:detected', (data) => {
      const newEvent: NetworkEvent = {
        id: `evt-${eventIdCounter.current++}`,
        ...data,
        type: 'resonance',
      };

      setEvents(prev => [newEvent, ...prev].slice(0, maxEvents));
    });

    return () => {
      socket.disconnect();
    };
  }, [maxEvents]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getEventIcon = (type: NetworkEvent['type']) => {
    switch (type) {
      case 'resonance':
        return '🧠';
      case 'memory_upload':
        return '💾';
      case 'agent_join':
        return '👋';
      default:
        return '•';
    }
  };

  const getEventColor = (similarity: number) => {
    if (similarity >= 0.95) return 'border-purple-500 bg-purple-500/10';
    if (similarity >= 0.90) return 'border-blue-500 bg-blue-500/10';
    if (similarity >= 0.85) return 'border-cyan-500 bg-cyan-500/10';
    return 'border-gray-500 bg-gray-500/10';
  };

  // Row renderer for virtual list
  const EventRow = ({ index }: { index: number }) => {
    const event = events[index];

    return (
      <div className="px-2 mb-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => onEventClick?.(event)}
          className={`
            border rounded-lg p-3 cursor-pointer
            hover:scale-[1.02] transition-transform
            ${getEventColor(event.similarity)}
          `}
        >
          <div className="flex items-start space-x-3">
            <div className="text-2xl">{getEventIcon(event.type)}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-white truncate">
                  {event.consumerName}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-sm font-medium text-blue-400 truncate">
                  {event.providerName}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <span>Similarity:</span>
                    <span className="font-mono text-white">
                      {(event.similarity * 100).toFixed(1)}%
                    </span>
                  </span>

                  {event.cost > 0 && (
                    <span className="flex items-center space-x-1">
                      <span>Cost:</span>
                      <span className="font-mono text-yellow-400">
                        {event.cost.toFixed(4)} $AMEM
                      </span>
                    </span>
                  )}
                </div>

                <span>{formatTimestamp(event.timestamp)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">Live Activity</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Real-time</span>
        </div>
      </div>

      {events.length > 0 ? (
        <List
          defaultHeight={600}
          rowCount={events.length}
          rowHeight={120}
          rowComponent={EventRow}
          rowProps={{}}
          className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        />
      ) : (
        <div className="text-center py-8 text-gray-500 h-[600px] flex flex-col items-center justify-center">
          <div className="text-4xl mb-2">🌌</div>
          <div className="text-sm">No recent activity</div>
          <div className="text-xs mt-1">Waiting for resonances...</div>
        </div>
      )}

      {/* Event Statistics */}
      <div className="border-t border-gray-700 pt-3 grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{events.length}</div>
          <div className="text-xs text-gray-400">Events</div>
        </div>

        <div className="text-center">
          <div className="text-lg font-bold text-purple-400">
            {events.filter(e => e.similarity >= 0.95).length}
          </div>
          <div className="text-xs text-gray-400">High Match</div>
        </div>

        <div className="text-center">
          <div className="text-lg font-bold text-yellow-400">
            {events.reduce((sum, e) => sum + e.cost, 0).toFixed(3)}
          </div>
          <div className="text-xs text-gray-400">$AMEM Spent</div>
        </div>
      </div>
    </div>
  );
}
