"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion } from "@/lib/createStage";

gsap.registerPlugin(ScrollTrigger);

const ROWS = [
  { words: ["Identidad", "Generativa", "WebGL", "Movimiento"], dir: 1 },
  { words: ["Color", "Ruido", "Luz", "Shader"], dir: -1 },
  { words: ["Aurora", "2026", "Sistema", "Visual"], dir: 1 },
];

/**
 * AURORA B — Marquesinas infinitas que reaccionan a la velocidad del scroll.
 * - Cada fila tiene su contenido duplicado y un tween que la mueve -50% en bucle
 *   (al llegar a la mitad se ve igual que al inicio, así no se nota el salto).
 * - ScrollTrigger.getVelocity() acelera el tween (timeScale) y cambia su
 *   dirección según hacia dónde haces scroll.
 * - La inclinación (skewX) también depende de la velocidad y vuelve a 0 sola.
 */
export default function VelocityMarquee() {
  const wrap = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const rows = gsap.utils.toArray(".marquee-track", wrap.current);
      const tweens = rows.map((track, i) =>
        gsap.fromTo(
          track,
          { xPercent: ROWS[i].dir > 0 ? 0 : -50 },
          { xPercent: ROWS[i].dir > 0 ? -50 : 0, duration: 22 + i * 4, ease: "none", repeat: -1 }
        )
      );

      const skew = gsap.quickTo(".marquee-track", "skewX", { duration: 0.5, ease: "power3.out" });
      let direction = 1;

      ScrollTrigger.create({
        trigger: wrap.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const v = self.getVelocity();
          direction = self.direction;
          const boost = 1 + Math.min(Math.abs(v) / 250, 8);
          tweens.forEach((tw) => {
            gsap.to(tw, { timeScale: boost * direction, duration: 0.2, overwrite: true });
            // Después de acelerar, vuelve suave a la velocidad normal
            gsap.to(tw, { timeScale: direction, duration: 1.2, delay: 0.2, ease: "power2.out" });
          });
          skew(gsap.utils.clamp(-12, 12, v / -150));
        },
        onLeave: () => skew(0),
        onLeaveBack: () => skew(0),
      });

      // Cuando dejas de hacer scroll, la inclinación vuelve a 0
      const settle = () => skew(0);
      ScrollTrigger.addEventListener("scrollEnd", settle);
      return () => ScrollTrigger.removeEventListener("scrollEnd", settle);
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="marquee-section">
      <p className="eyebrow marquee-kicker">Aurora · 02 · Marquesina por velocidad</p>
      {ROWS.map((row, i) => (
        <div key={i} className={`marquee-row ${i === 1 ? "is-outline" : ""}`}>
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <span key={copy} className="marquee-copy" aria-hidden={copy === 1}>
                {row.words.map((w) => (
                  <span key={w} className="marquee-word">
                    {w}
                    <span className="marquee-dot">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      ))}
      <p className="marquee-hint">Haz scroll rápido hacia arriba y hacia abajo.</p>
    </section>
  );
}
