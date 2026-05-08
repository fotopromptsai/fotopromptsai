const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const BASE_BETA = "https://generativelanguage.googleapis.com/v1beta/models";

function stripBase64Prefix(b64: string) {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

export interface PromptDetails {
  pose: string;
  outfit: string;
  background: string;
  lighting: string;
  camera: string;
  base: string;
  facePreservation: string;
}

export async function analyzeImage(imageBase64: string): Promise<PromptDetails> {
  const res = await fetch(`${BASE_BETA}/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: stripBase64Prefix(imageBase64),
            },
          },
          {
            text: `Analyze this reference photo and extract technical photography details.
Return ONLY a valid JSON object with these exact fields:
{
  "base": "main scene description and overall mood in English",
  "facePreservation": "instruction to preserve subject facial features in English",
  "pose": "body pose and positioning in English",
  "outfit": "clothing and accessories description in English",
  "background": "background environment description in English",
  "lighting": "lighting setup and quality in English",
  "camera": "camera angle, lens and shot type in English"
}
Be specific and technical. Use photography and cinematography terminology.`,
          },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini analyze error ${res.status}`);
  }

  const json = await res.json();
  const allParts: any[] = json.candidates?.[0]?.content?.parts ?? [];
  const textPart = [...allParts].reverse().find((p: any) => p.text && !p.thought);
  const text = textPart?.text;
  if (!text) throw new Error("A IA não retornou um prompt estruturado.");

  return JSON.parse(text) as PromptDetails;
}

export async function analyzeFace(imageBase64: string): Promise<string> {
  const res = await fetch(`${BASE_BETA}/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: stripBase64Prefix(imageBase64),
            },
          },
          {
            text: `Describe the physical appearance of the person in this photo with extreme detail for use in AI image generation. Focus on:
- Face shape (oval, round, square, heart, etc.)
- Eye color, shape, and size
- Eyebrow shape and color
- Nose shape and size
- Lip shape, thickness, and color
- Skin tone (use precise terms: fair, light, medium, tan, brown, deep, etc.)
- Cheekbones and jaw structure
- Hair color, texture (straight, wavy, curly, coily), length, and style
- Age range
- Any distinctive features (dimples, freckles, beauty marks, etc.)

Write a single detailed paragraph in English. Be precise and objective. This description will be used to recreate this exact person's face in AI image generation.`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini face analyze error ${res.status}`);
  }

  const json = await res.json();
  const allParts: any[] = json.candidates?.[0]?.content?.parts ?? [];
  const textPart = [...allParts].reverse().find((p: any) => p.text && !p.thought);
  const text = textPart?.text;
  if (!text) throw new Error("A IA não conseguiu analisar o rosto.");

  return text.trim();
}

export async function generateImage(
  prompt: string,
  userImageBase64: string,
  _referenceImageBase64: string,
  faceDescription: string
): Promise<string> {
  const res = await fetch(`/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      userImage: stripBase64Prefix(userImageBase64),
      faceDescription,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Erro ao gerar imagem (${res.status})`);
  }

  const json = await res.json();
  const allParts: any[] = json.candidates?.[0]?.content?.parts ?? [];
  const imageParts = allParts.filter((p: any) => p.inlineData && !p.thought);
  const part = imageParts[imageParts.length - 1]; // última imagem = resultado final (não rascunho)
  const b64 = part?.inlineData?.data;
  const mime = part?.inlineData?.mimeType ?? "image/png";
  if (!b64) throw new Error("A IA não gerou uma imagem.");

  return `data:${mime};base64,${b64}`;
}
