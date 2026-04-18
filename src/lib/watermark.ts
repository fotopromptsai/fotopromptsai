export async function applyWatermark(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const text = "PersonaRefine AI";
      const fontSize = Math.max(img.width * 0.038, 16);
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

      // Draw on a grid large enough to cover the whole image after rotation
      const diag = Math.ceil(Math.sqrt(img.width ** 2 + img.height ** 2));
      const cols = Math.ceil((diag * 2) / colGap) + 2;
      const rows = Math.ceil((diag * 2) / rowGap) + 2;

      ctx.translate(img.width / 2, img.height / 2);
      ctx.rotate(angle);

      for (let row = -rows; row <= rows; row++) {
        const offsetX = (row % 2) * (colGap / 2); // stagger alternate rows
        for (let col = -cols; col <= cols; col++) {
          ctx.fillText(text, col * colGap + offsetX, row * rowGap);
        }
      }

      ctx.restore();
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}
