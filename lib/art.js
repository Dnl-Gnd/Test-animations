/**
 * Genera "imágenes" abstractas con <canvas> (degradado + círculos) para no
 * depender de archivos. En un proyecto real las cambiarías por fotos.
 */
export function drawArt({ a, b, seed = 0, width = 480, height = 600, label = "" }) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(
      width * (0.15 + ((i * 37 + seed * 13) % 70) / 100),
      height * (0.1 + ((i * 53 + seed * 7) % 80) / 100),
      width * (0.12 + ((i * 29 + seed * 5) % 30) / 100),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)";
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  if (label) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `600 ${Math.round(width / 9)}px system-ui, sans-serif`;
    ctx.fillText(label, width * 0.08, height * 0.9);
  }
  return c;
}

export const artDataURL = (opts) => drawArt(opts).toDataURL("image/jpeg", 0.85);
