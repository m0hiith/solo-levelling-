import { GoogleGenAI, Type } from '@google/genai';
import { Reminder } from '../types';
import { API_KEY, ChatTurn, isAiConfigured, SystemContext } from '../lib/ai';
import { hasAlertLinesForToday, writeAlertLines } from '../lib/alertCopy';

const MODEL = 'gemini-3-flash-preview';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.');
  }
  client ??= new GoogleGenAI({ apiKey: API_KEY });
  return client;
}

// ── Shared context ───────────────────────────────────────

const PERSONA = `You are "The System" from Solo Leveling: a cold, clinical, faintly menacing interface that evaluates a hunter.

RULES:
- Second person. Address the hunter directly.
- Never apologise, never hedge, never use emoji, never use exclamation marks in a row.
- Reference the SPECIFIC numbers and quest names you are given. Vague motivation is a failure.
- The hunter is running a fixed-length pact with a partner. Comparison between the two is fair game and should sting a little, but never be cruel about the partner.
- Praise is rationed: acknowledge streaks, then immediately name the next threat.`;

function contextBlock(ctx: SystemContext): string {
  const lines = [
    `HUNTER: ${ctx.playerName} — Level ${ctx.level}, Rank ${ctx.rank}`,
    `PACT: day ${ctx.pactDay} of ${ctx.pactTotal}; ${ctx.clearedDays} days cleared so far`,
    `STREAK: ${ctx.streak} (best ${ctx.bestStreak})`,
    `TODAY: ${ctx.dailyDone}/${ctx.dailyTotal} daily quests cleared`,
    `OPEN QUESTS: ${ctx.openQuests.length ? ctx.openQuests.join(', ') : 'none'}`,
    `TODAY'S INTAKE: ${ctx.caloriesToday} kcal · training volume ${ctx.volumeToday} kg`,
  ];
  if (ctx.partnerName) {
    lines.push(
      `PARTNER: ${ctx.partnerName} — streak ${ctx.partnerStreak ?? 0}, ${ctx.partnerClearedDays ?? 0} days cleared, ${ctx.partnerDailyDone ?? 0}/${ctx.partnerDailyTotal ?? 0} today`,
    );
  }
  return lines.join('\n');
}

// ── Coach ────────────────────────────────────────────────

/**
 * Streams the reply so the first words land in well under a second instead of the
 * player staring at a spinner for the whole generation.
 */
export async function streamSystemReply(
  ctx: SystemContext,
  history: ChatTurn[],
  message: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const stream = await getClient().models.generateContentStream({
    model: MODEL,
    config: {
      systemInstruction: `${PERSONA}\n\nCURRENT STATE:\n${contextBlock(ctx)}`,
      // Short by design: this is a HUD broadcast, not an essay.
      maxOutputTokens: 400,
      temperature: 1.0,
    },
    contents: [
      ...history.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
      { role: 'user' as const, parts: [{ text: message }] },
    ],
  });

  let full = '';
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const text = chunk.text;
    if (!text) continue;
    full += text;
    onChunk(text);
  }

  return full || 'The System is monitoring your progress. Do not falter.';
}

/** The unprompted evaluation shown when the Coach tab opens. */
export function streamEvaluation(
  ctx: SystemContext,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = ctx.dailyTotal === 0
    ? 'The hunter has registered no daily quests. Order them to define their daily quests. Two sentences, maximum.'
    : 'Deliver an unprompted System evaluation of this hunter right now. Name at least one specific number or quest. Three sentences, maximum.';
  return streamSystemReply(ctx, [], prompt, onChunk, signal);
}

// ── Alert copy ───────────────────────────────────────────

/**
 * Writes a day's worth of alert copy in ONE batched call, at most once per day.
 *
 * Alerts never wait on this — they render from the local phrase bank and pick up these
 * lines on a later fire. Batching keeps the whole feature to a single request per day
 * instead of one per buzz.
 */
export async function refreshAlertLines(
  ctx: SystemContext,
  reminders: Reminder[],
): Promise<boolean> {
  if (!isAiConfigured() || hasAlertLinesForToday()) return false;

  const armed = reminders.filter(r => r.enabled).slice(0, 12);
  if (armed.length === 0) return false;

  const response = await getClient().models.generateContent({
    model: MODEL,
    config: {
      systemInstruction: `${PERSONA}\n\nCURRENT STATE:\n${contextBlock(ctx)}`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          alerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                lines: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['id', 'lines'],
            },
          },
        },
        required: ['alerts'],
      },
    },
    contents: `Write push-notification copy for today's alerts. For each alert id below, return 3 different one-sentence lines, each under 110 characters, in the System's voice. Make them specific to this hunter's current state.

${armed.map(r => `- id "${r.id}" — ${r.label}: ${r.body}`).join('\n')}`,
  });

  if (!response.text) return false;

  try {
    const parsed = JSON.parse(response.text) as { alerts?: { id: string; lines: string[] }[] };
    const lines: Record<string, string[]> = {};
    for (const alert of parsed.alerts ?? []) {
      const usable = (alert.lines ?? []).filter(l => typeof l === 'string' && l.trim());
      if (usable.length) lines[alert.id] = usable;
    }
    writeAlertLines(lines);
    return true;
  } catch {
    // A malformed body just means today runs on the local phrase bank.
    return false;
  }
}

// ── Food scan ────────────────────────────────────────────

export interface CalorieEstimate {
  food: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix — the API wants the payload only.
      const [, payload] = result.split(',');
      if (!payload) reject(new Error('Could not read the image data.'));
      else resolve(payload);
    };
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

export async function detectCalories(file: File): Promise<CalorieEstimate | null> {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: {
      parts: [
        {
          text: 'Analyze this food image and estimate calories, protein, carbs, and fat. Return JSON format.',
        },
        {
          inlineData: {
            data: await fileToBase64(file),
            // Use the real type: sending a PNG labelled as JPEG can be rejected outright.
            mimeType: file.type || 'image/jpeg',
          },
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          food: { type: Type.STRING },
          calories: { type: Type.INTEGER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
        },
        required: ['food', 'calories'],
      },
    },
  });

  if (!response.text) return null;

  try {
    // A malformed body would otherwise throw a bare SyntaxError at the call site.
    return JSON.parse(response.text) as CalorieEstimate;
  } catch {
    throw new Error('The food scan returned an unreadable response.');
  }
}
