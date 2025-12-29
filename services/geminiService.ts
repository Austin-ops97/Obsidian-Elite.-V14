
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const fetchWithRetry = async (
  fn: () => Promise<any>,
  retries: number = 5,
  delay: number = 1000
): Promise<any> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    // Simple exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 2);
  }
};

export const processAIImage = async (
  modelName: string,
  imageBlob: string, // Base64 for current SDK compatibility in parts
  prompt: string,
  systemInstruction: string
): Promise<string | null> => {
  // Always create a new instance with the latest API_KEY from process.env
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const base64Data = imageBlob.split(',')[1] || imageBlob;

  const performCall = async () => {
    return await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });
  };

  const response: GenerateContentResponse = await fetchWithRetry(performCall);
  
  // Find image part in the response
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  return null;
};
