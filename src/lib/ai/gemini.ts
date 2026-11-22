import type { AnalysisProvider } from './provider';
import { requestJson } from './provider';
import { AiError } from './parse';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EXCLUDED = /tts|image|live|audio|embedding|native/i;

interface ModelList {
  models?: { name: string; supportedGenerationMethods?: string[] }[];
}
interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export const gemini: AnalysisProvider = {
  id: 'gemini',

  async listModels(key) {
    const data = (await requestJson(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })) as ModelList;
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((id) => id.includes('gemini') && id.includes('flash') && !EXCLUDED.test(id));
  },

  async generateJson({ key, model, prompt, images }) {
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, ...images.map((i) => ({ inline_data: { mime_type: i.mimeType, data: i.base64 } }))],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    };
    const data = (await requestJson(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    })) as GenerateResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text) throw new AiError('reponse');
    return text;
  },
};
