/**
 * The AI surface that is safe to import from the initial bundle.
 *
 * `@google/genai` is a heavy dependency, and pulling it in from the alert engine —
 * which every screen depends on — would drag it into the first paint. Everything the
 * app needs BEFORE a model call (is a key configured? what does the context look
 * like?) lives here; `services/gemini.ts` holds the SDK and is imported dynamically.
 */

/**
 * NOTE: vite injects GEMINI_API_KEY into the client bundle, so the key ships to the
 * browser and is readable by anyone who loads the app. That is acceptable only for a
 * local, two-player build — before deploying this publicly the Gemini calls need to
 * move behind a server route that holds the key.
 */
export const API_KEY = process.env.GEMINI_API_KEY || '';

export function isAiConfigured(): boolean {
  return API_KEY.length > 0;
}

/**
 * Everything the Architect is allowed to know. Passing the whole pact state — both
 * players, the day number, what is still open — is what turns generic gym-bro filler
 * into a message that names the actual quest you are avoiding.
 */
export interface SystemContext {
  playerName: string;
  level: number;
  rank: string;
  streak: number;
  bestStreak: number;
  pactDay: number;
  pactTotal: number;
  clearedDays: number;
  dailyDone: number;
  dailyTotal: number;
  openQuests: string[];
  caloriesToday: number;
  volumeToday: number;
  partnerName?: string;
  partnerStreak?: number;
  partnerClearedDays?: number;
  partnerDailyDone?: number;
  partnerDailyTotal?: number;
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}
