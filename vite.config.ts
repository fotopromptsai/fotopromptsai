import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import type { Plugin } from 'vite';

function apiDevPlugin(apiKey: string): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use('/api/generate-image', async (req, res) => {
        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
        if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }

        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', async () => {
          try {
            const { prompt, userImage, faceDescription } = JSON.parse(Buffer.concat(chunks).toString());

            const parts: object[] = [];
            if (userImage) {
              parts.push({ inline_data: { mime_type: 'image/jpeg', data: userImage } });
            }
            parts.push({ text: `Generate a professional photorealistic portrait. CRITICAL FACE REQUIREMENTS: The person must have EXACTLY these facial features: ${faceDescription}. The reference photo of this person is provided above — replicate their face with 100% accuracy. Do NOT change any facial features. Apply ONLY these photography style specifications: ${prompt}` });

            const upstream = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts }],
                  generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
                }),
              }
            );

            const json = await upstream.json().catch(() => null);
            const status = upstream.ok ? 200 : upstream.status;
            const body = upstream.ok && json
              ? json
              : { error: json?.error?.message ?? `Gemini error ${upstream.status}` };

            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(body));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin(env.VITE_GEMINI_API_KEY)],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL': JSON.stringify('https://script.google.com/macros/s/AKfycbyJ410UW_3SHnGGo8qtJeiXNXh6klth8BQhp071Z3092zvF6fOFxZrGdqKoZyxgHRGNig/exec'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
