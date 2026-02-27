/**
 * CodeChatPanel — Right sidebar AI chat for Graph RAG queries
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { MessageCircle, X, Send, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { ChatMessage, ChatToolCall } from '../../../server/code-graph/types';

interface CodeChatPanelProps {
  owner: string;
  repo: string;
  onClose: () => void;
  onNodeHighlight: (nodeIds: string[]) => void;
}

function ToolCallDisplay({ toolCall }: { toolCall: ChatToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5 rounded-lg bg-white/5 border border-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-mono text-cyan-400/60">{toolCall.name}</span>
        <span className="text-white/20">({Object.values(toolCall.args).join(', ')})</span>
      </button>
      {expanded && toolCall.result && (
        <div className="px-3 pb-2 text-[10px] text-white/30 whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono">
          {toolCall.result}
        </div>
      )}
    </div>
  );
}

export function CodeChatPanel({ owner, repo, onClose, onNodeHighlight }: CodeChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.codeGraph.chat.useMutation({
    onSuccess: (data) => {
      const response = data as ChatMessage;
      setMessages((prev) => [...prev, response]);
    },
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    chatMutation.mutate({
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      owner,
      repo,
    });
  }, [input, messages, owner, repo, chatMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="absolute top-6 right-6 z-20 w-[360px] max-h-[calc(100vh-180px)] flex flex-col bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-sm text-white font-medium">
          <MessageCircle className="h-4 w-4 text-cyan-400" />
          Nexus AI
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center py-8 text-white/20 text-xs">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <div>Ask about the codebase</div>
            <div className="mt-2 text-[10px] space-y-1 text-white/15">
              <div>"How does the auth system work?"</div>
              <div>"What calls buildCodeGraph?"</div>
              <div>"Give me an overview"</div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2 text-sm text-white/80 max-w-[85%]">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-1">
                {msg.toolCalls?.map((tc, j) => (
                  <ToolCallDisplay key={j} toolCall={tc} />
                ))}
                <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-white/5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the codebase..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/30 placeholder:text-white/25 resize-none max-h-[80px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-30 rounded-lg text-cyan-400 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
