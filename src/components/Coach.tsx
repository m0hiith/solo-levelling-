import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { streamEvaluation, streamSystemReply } from '../services/gemini';
import { ChatTurn, isAiConfigured } from '../lib/ai';
import { buildSystemContext } from '../lib/context';
import { logActivity } from '../store';
import { m } from 'motion/react';
import { AlertCircle, Bot, Loader2, Send, Terminal, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface CoachProps {
  profile: UserProfile;
  userId: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

/** One tap instead of typing, which is how this actually gets used on a phone. */
const PROMPTS = [
  'Evaluate my day so far.',
  'Am I ahead or behind my partner?',
  'Give me a workout for today.',
  'I want to quit. Talk me out of it.',
];

export function Coach({ profile, userId }: CoachProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const configured = useMemo(isAiConfigured, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Abort an in-flight stream when the tab is left, so its chunks cannot land on a
  // dead component or bleed into the next conversation.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Appends an empty model message, then fills it in as chunks arrive. */
  const runStream = useCallback(
    async (
      history: ChatTurn[],
      send: (onChunk: (text: string) => void, signal: AbortSignal) => Promise<string>,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const id = `${Date.now()}-${history.length}`;
      setStreaming(true);
      setError(null);
      setMessages(prev => [...prev, { id, role: 'model', content: '' }]);

      try {
        await send(chunk => {
          setMessages(prev =>
            prev.map(m => (m.id === id ? { ...m, content: m.content + chunk } : m)),
          );
        }, controller.signal);
        logActivity('system', 'System evaluation received from the AI Architect.');
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[coach] stream failed', err);
        setError(err instanceof Error ? err.message : 'The System could not be reached.');
        setMessages(prev => prev.filter(m => m.id !== id));
      } finally {
        if (!controller.signal.aborted) setStreaming(false);
      }
    },
    [],
  );

  const ask = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || streaming || !configured) return;

      const history: ChatTurn[] = messages
        .filter(m => m.content)
        .map(m => ({ role: m.role, text: m.content }));

      setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message }]);
      setInput('');

      const ctx = buildSystemContext(profile, userId);
      void runStream(history, (onChunk, signal) =>
        streamSystemReply(ctx, history, message, onChunk, signal),
      );
    },
    [configured, messages, profile, runStream, streaming, userId],
  );

  // One unprompted broadcast per mount. The ref guard stops StrictMode's
  // double-invoked effect from firing two calls in development.
  useEffect(() => {
    if (opened.current || !configured) return;
    opened.current = true;
    const ctx = buildSystemContext(profile, userId);
    void runStream([], (onChunk, signal) => streamEvaluation(ctx, onChunk, signal));
    // Intentionally mount-only: a re-broadcast on every XP change would be noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-14rem)] flex flex-col">
      <header className="mb-6 border-l-4 border-primary pl-4">
        <h1 className="font-headline text-3xl font-bold uppercase tracking-tighter">
          AI <span className="text-primary">ARCHITECT</span>
        </h1>
        <p className="text-[10px] text-outline uppercase tracking-widest">
          Reads your pact, your streak and your partner's
        </p>
      </header>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4" ref={scrollRef}>
        {!configured && (
          <div className="bg-surface border-l-2 border-error p-6 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-headline font-bold uppercase tracking-widest text-error mb-1">
                Link Severed
              </p>
              <p className="text-sm text-outline">
                No <code>GEMINI_API_KEY</code> is configured. Add it to <code>.env.local</code> and
                restart the dev server to bring the Architect online. Everything else in the HUD —
                quests, alerts, the pact grid — works without it.
              </p>
            </div>
          </div>
        )}

        {messages.map(msg =>
          msg.role === 'user' ? (
            <m.div
              key={msg.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-end"
            >
              <div className="max-w-[80%] p-4 bg-surface/60 border-r-2 border-secondary">
                <div className="flex items-center gap-2 mb-1.5 text-secondary justify-end">
                  <span className="text-[8px] font-headline font-bold uppercase tracking-widest">
                    HUNTER
                  </span>
                  <User className="w-3 h-3" />
                </div>
                <p className="text-sm text-on-surface text-right">{msg.content}</p>
              </div>
            </m.div>
          ) : (
            <m.div
              key={msg.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[85%] p-5 bg-surface border-l-2 border-primary">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Terminal className="w-3 h-3" />
                  <span className="text-[8px] font-headline font-bold uppercase tracking-widest">
                    SYSTEM BROADCAST
                  </span>
                </div>
                {msg.content ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-[10px] font-headline text-outline uppercase animate-pulse">
                    Decrypting System pulse…
                  </span>
                )}
              </div>
            </m.div>
          ),
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

      {/* Prompt chips — only while the conversation is short enough to need them. */}
      {configured && messages.length < 3 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {PROMPTS.map(prompt => (
            <button
              key={prompt}
              onClick={() => ask(prompt)}
              disabled={streaming}
              className="border border-white/10 text-outline px-3 py-2 text-[10px] font-headline uppercase tracking-widest hover:text-secondary hover:border-secondary/40 transition-all disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface p-3 border border-white/5 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={!configured || streaming}
          placeholder={configured ? 'ASK THE SYSTEM…' : 'ARCHITECT OFFLINE'}
          aria-label="Message the System"
          className="flex-1 bg-background border border-white/10 px-4 py-3 text-sm font-headline tracking-widest outline-none focus:border-primary transition-colors disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!configured || streaming || !input.trim()}
          className={cn(
            'bg-primary text-background px-6 font-headline font-bold uppercase tracking-widest',
            'hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-40',
          )}
        >
          {streaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : messages.length === 0 ? (
            <Bot className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
