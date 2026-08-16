import { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile } from '../types';
import { getAICoachMessage, isAiConfigured } from '../services/gemini';
import { getTasks, logActivity } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Loader2, Terminal, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CoachProps {
  profile: UserProfile;
}

interface Message {
  id: string;
  content: string;
}

export function Coach({ profile }: CoachProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const triggerSystemMessage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Count what is actually outstanding rather than reporting a hardcoded zero.
      const missedTasks = getTasks().filter(t => !t.completed).length;
      const message = await getAICoachMessage({
        level: profile.level,
        rank: profile.rank,
        streak: profile.streak,
        missedTasks,
      });
      setMessages(prev => [...prev, { id: `${Date.now()}-${prev.length}`, content: message }]);
      logActivity('system', 'System evaluation received from the AI Architect.');
    } catch (err) {
      console.error('[coach] evaluation failed', err);
      setError(err instanceof Error ? err.message : 'The System could not be reached.');
    } finally {
      setLoading(false);
    }
  }, [profile.level, profile.rank, profile.streak]);

  // Fetch one opening broadcast per mount. The ref guard stops StrictMode's
  // double-invoked effect from firing two API calls in development.
  useEffect(() => {
    if (requested.current || !isAiConfigured()) return;
    requested.current = true;
    void triggerSystemMessage();
  }, [triggerSystemMessage]);

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-14rem)] flex flex-col">
      <header className="mb-8 border-l-4 border-primary pl-4">
        <h1 className="font-headline text-3xl font-bold uppercase tracking-tighter">
          AI <span className="text-primary">ARCHITECT</span>
        </h1>
        <p className="text-[10px] text-outline uppercase tracking-widest">
          System Monitoring Active
        </p>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 pr-4 mb-6" ref={scrollRef}>
        {!isAiConfigured() && (
          <div className="bg-surface border-l-2 border-error p-6 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-error mb-1">
                Link Severed
              </p>
              <p className="text-sm text-outline">
                No <code>GEMINI_API_KEY</code> is configured. Add it to{' '}
                <code>.env.local</code> and restart the dev server to bring the Architect online.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[80%] p-6 bg-surface border-l-2 border-primary">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Terminal className="w-3 h-3" />
                  <span className="text-[8px] font-headline font-bold uppercase tracking-widest">
                    SYSTEM BROADCAST
                  </span>
                </div>
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
              <span className="text-[10px] font-headline text-outline uppercase animate-pulse">
                Decrypting System Pulse...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-surface p-4 border-l-2 border-error flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-error" />
              <span className="text-[10px] font-headline text-error uppercase tracking-widest">
                {error}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface p-4 border border-white/5 flex gap-4">
        <button
          onClick={triggerSystemMessage}
          disabled={loading || !isAiConfigured()}
          className="flex-1 bg-primary text-background py-4 font-headline font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Bot className="w-4 h-4" />
          REQUEST SYSTEM EVALUATION
        </button>
      </div>
    </div>
  );
}
