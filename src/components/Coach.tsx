import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { getAICoachMessage } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, Loader2, Terminal, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CoachProps {
  profile: UserProfile | null;
}

export function Coach({ profile }: CoachProps) {
  const [messages, setMessages] = useState<{ role: 'system' | 'user', content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const triggerSystemMessage = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const message = await getAICoachMessage({
        level: profile.level,
        rank: profile.rank,
        streak: profile.streak,
        missedTasks: 0 // In a real app, calculate this
      });
      setMessages(prev => [...prev, { role: 'system', content: message }]);
    } catch (error) {
      console.error("Coach failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length === 0) {
      triggerSystemMessage();
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <header className="mb-8 border-l-4 border-primary pl-4">
        <h1 className="font-headline text-3xl font-bold uppercase tracking-tighter">AI <span className="text-primary">ARCHITECT</span></h1>
        <p className="text-[10px] text-outline uppercase tracking-widest">System Monitoring Active</p>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 pr-4 mb-6 scrollbar-hide" ref={scrollRef}>
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.role === 'system' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${msg.role === 'system' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[80%] p-6 relative ${msg.role === 'system' ? 'bg-surface border-l-2 border-primary' : 'bg-primary-container text-on-primary-container'}`}>
                {msg.role === 'system' && (
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Terminal className="w-3 h-3" />
                    <span className="text-[8px] font-headline font-bold uppercase tracking-widest">SYSTEM BROADCAST</span>
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface p-4 border-l-2 border-primary flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-[10px] font-headline text-outline uppercase animate-pulse">Decrypting System Pulse...</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface p-4 border border-white/5 flex gap-4">
        <button 
          onClick={triggerSystemMessage}
          disabled={loading}
          className="flex-1 bg-primary text-background py-4 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Bot className="w-4 h-4" />
          REQUEST SYSTEM EVALUATION
        </button>
      </div>
    </div>
  );
}
