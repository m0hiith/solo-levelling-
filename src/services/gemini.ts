import { GoogleGenAI, Type } from '@google/genai';

const MODEL = 'gemini-3-flash-preview';

/**
 * NOTE: vite injects GEMINI_API_KEY into the client bundle, so the key ships to the
 * browser and is readable by anyone who loads the app. That is acceptable only for a
 * local, single-user build — before deploying this publicly the Gemini calls need to
 * move behind a server route that holds the key.
 */
const API_KEY = process.env.GEMINI_API_KEY || '';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.');
  }
  client ??= new GoogleGenAI({ apiKey: API_KEY });
  return client;
}

export function isAiConfigured(): boolean {
  return API_KEY.length > 0;
}

export async function getAICoachMessage(userStats: {
  level: number;
  rank: string;
  streak: number;
  missedTasks: number;
}): Promise<string> {
  const prompt = `You are the System from Solo Leveling. Speak in a cold, commanding, and intimidating tone.
  User Stats:
  - Level: ${userStats.level}
  - Rank: ${userStats.rank}
  - Streak: ${userStats.streak}
  - Missed Tasks Today: ${userStats.missedTasks}

  Generate a short motivational message (max 2 sentences). If they missed tasks, be more threatening. If they have a high streak, acknowledge their growth but warn against stagnation.`;

  const response = await getClient().models.generateContent({ model: MODEL, contents: prompt });

  return response.text || 'The System is monitoring your progress. Do not falter.';
}

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
