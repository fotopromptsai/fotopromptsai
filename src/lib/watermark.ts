const MAX_CANVAS_PX = 1200; // cap para não explodir memória em mobile

export async function applyWatermark(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onerror = () => resolve(imageUrl); // fallback: retorna original sem marca

    img.onload = () => {
      try {
        // Reduz dimensões se necessário (iOS Safari tem limite ~4096x4096 e RAM baixa)
        let w = img.width;
        let h = img.height;
        if (w > MAX_CANVAS_PX || h > MAX_CANVAS_PX) {
          const ratio = Math.min(MAX_CANVAS_PX / w, MAX_CANVAS_PX / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(imageUrl); return; }

        ctx.drawImage(img, 0, 0, w, h);

        const text = "FotoPrompts AI";
        const fontSize = Math.max(w * 0.038, 14);
        ctx.font = `bold ${fontSize}px sans-serif`;

        const textWidth = ctx.measureText(text).width;
        const colGap = textWidth + fontSize * 4;
        const rowGap = fontSize * 5;
        const angle = -Math.PI / 5;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        const diag = Math.ceil(Math.sqrt(w ** 2 + h ** 2));
        const cols = Math.ceil((diag * 2) / colGap) + 2;
        const rows = Math.ceil((diag * 2) / rowGap) + 2;

        ctx.translate(w / 2, h / 2);
        ctx.rotate(angle);

        for (let row = -rows; row <= rows; row++) {
          const offsetX = (row % 2) * (colGap / 2);
          for (let col = -cols; col <= cols; col++) {
            ctx.fillText(text, col * colGap + offsetX, row * rowGap);
          }
        }

        ctx.restore();
        resolve(canvas.toDataURL("image/jpeg", 0.88)); // JPEG é menor e mais rápido que PNG em mobile
      } catch {
        resolve(imageUrl); // qualquer erro: retorna original sem marca
      }
    };

    img.src = imageUrl;
  });
}
