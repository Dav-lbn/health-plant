import type { AnalysisProvider } from './provider';
import { requestJson } from './provider';
import { AiError } from './parse';

export const MISTRAL_API = 'https://api.mistral.ai';

interface ModelList {
  data?: { id: string; capabilities?: { vision?: boolean } }[];
}
interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

export function mistral(base: string = MISTRAL_API): AnalysisProvider {
  const root = (base || MISTRAL_API).replace(/\/+$/, '');
  return {
    id: 'mistral',

    async listModels(key) {
      const data = (await requestJson(`${root}/v1/models`, { headers: { Authorization: `Bearer ${key}` } })) as ModelList;
      const ids = (data.data ?? []).filter((m) => m.capabilities?.vision).map((m) => m.id);
      return [...new Set(ids)];
    },

    async generateJson({ key, model, prompt, images }) {
      const body = {
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...images.map((i) => ({ type: 'image_url', image_url: `data:${i.mimeType};base64,${i.base64}` })),
            ],
          },
        ],
      };
      const data = (await requestJson(`${root}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      })) as ChatResponse;
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new AiError('reponse');
      return text;
    },
  };
}
