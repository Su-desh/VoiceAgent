'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from '@/types';
import { Sparkles, User, Bot, MessageSquare } from 'lucide-react';

interface LiveTranscriptProps {
  messages: Message[];
  isOpen: boolean;
  onToggle: () => void;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({ messages, isOpen, onToggle }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-amber-500/30 text-amber-200 text-xs font-semibold hover:border-amber-400 shadow-xl backdrop-blur-md transition-all group"
      >
        <MessageSquare className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
        <span>{isOpen ? 'Hide Live Dialogue' : 'Show Live Dialogue & Transcript'}</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </button>

      {/* Floating Transcript Window */}
      {isOpen && (
        <div className="mt-2 w-80 md:w-96 h-80 bg-slate-900/95 border border-amber-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-lg animate-in fade-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white">Live Conversation Transcript</h4>
            </div>
            <span className="text-[10px] text-amber-300/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Aarav • Concierge
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {messages.map((msg) => {
              const isAgent = msg.sender === 'agent';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isAgent ? 'items-start' : 'items-start flex-row-reverse'}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                      isAgent
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {isAgent ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>

                  <div
                    className={`p-2.5 rounded-xl max-w-[82%] leading-relaxed ${
                      isAgent
                        ? 'bg-slate-950/80 border border-slate-800 text-slate-200'
                        : 'bg-amber-600/90 text-slate-950 font-medium'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span className="text-[9px] opacity-60 mt-1 block text-right">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
};
