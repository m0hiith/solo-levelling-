import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getAICoachMessage(userStats: {
  level: number;
  rank: string;
  streak: number;
  missedTasks: number;
}) {
  const model = "gemini-3-flash-preview";
  const prompt = `You are the System from Solo Leveling. Speak in a cold, commanding, and intimidating tone.
  User Stats:
  - Level: ${userStats.level}
  - Rank: ${userStats.rank}
  - Streak: ${userStats.streak}
  - Missed Tasks Today: ${userStats.missedTasks}

  Generate a short motivational message (max 2 sentences). If they missed tasks, be more threatening. If they have a high streak, acknowledge their growth but warn against stagnation.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "The System is monitoring your progress. Do not falter.";
}

export async function detectCalories(imageData: string) {
  const model = "gemini-3-flash-preview";
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: "Analyze this food image and estimate calories, protein, carbs, and fat. Return JSON format." },
        { inlineData: { data: imageData.split(',')[1], mimeType: "image/jpeg" } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          food: { type: Type.STRING },
          calories: { type: Type.INTEGER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER }
        },
        required: ["food", "calories"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
