import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE_BETA = "https://generativelanguage.googleapis.com/v1beta/models";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });

  const { prompt, userImage, faceDescription } = req.body ?? {};
  if (!prompt) return res.status(400).json({ error: "Prompt ausente" });

  const parts: object[] = [];
  if (userImage) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: userImage } });
  }
  parts.push({ text: `Generate a hyper-realistic fine-art portrait photograph.

IDENTITY (DO NOT CHANGE): The subject must have EXACTLY these facial features: ${faceDescription}. The reference photo above is the source of truth — replicate face shape, skin tone, eye color, hair color and texture with 100% accuracy. Do NOT alter, beautify, or modify any facial feature, proportions, or ethnic characteristics.

PHOTOGRAPHY STYLE: ${prompt}

TECHNICAL REQUIREMENTS (always apply):
- Camera: Full-frame DSLR or mirrorless
- Lens: 85mm f/1.8 for natural portrait compression and background bokeh
- Skin: highly detailed skin texture, pore-level detail, realistic natural imperfections
- Resolution: 8K rendering quality, cinematic sharpness on face
- Style: Fine Art Portrait Photography, photorealistic, not AI-looking` });

  const upstream = await fetch(
    `${BASE_BETA}/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    }
  );

  const json = await upstream.json().catch(() => null);
  if (!upstream.ok || !json) {
    return res.status(upstream.status || 500).json({
      error: json?.error?.message ?? `Gemini error ${upstream.status}`,
    });
  }

  return res.status(200).json(json);
}
