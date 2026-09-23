"use client";

import { useRef, useState, useEffect } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { artDataURL } from "@/lib/art";

const PALETTE = [
  ["#ff4f7b", "#ffd36b"],
  ["#ff8a5c", "#6d4bff"],
  ["#ffd36b", "#0f7c8c"],
  ["#ff3d6e", "#2a0f3a"],
  ["#ffb38a", "#ff4f7b"],
  ["#7cffd4", "#ff4f7b"],
];
const POOL = 14;

/**
 * CORAL A — Rastro de imágenes que siguen al cursor.
 * Hay un grupo fijo de <img> (pool) que se reutiliza en orden. Cada vez que el
 * mouse recorre cierta distancia, la siguiente imagen aparece en ese punto:
 * crece desde 0, sigue un poco la dirección del movimiento y luego cae y se
 * desvanece. Reutilizar las mismas imágenes evita crear elementos nuevos.
 */
export default function ImageTrail() {
  const wrap = useRef(null);
  const [images, setImages] = useState([]);

  // Las imágenes se generan en el navegador (canvas), no en el servidor
  useEffect(() => {
    setImages(
      Array.from({ length: POOL }, (_, i) => {
        const [a, b] = PALETTE[i % PALETTE.length];
        return artDataURL({ a, b, seed: i, width: 320, height: 400 });
      })
    );
  }, []);

  useGSAP(
    () => {
      if (!images.length) return;
      const els = gsap.utils.toArray(".trail-img", wrap.current);
      gsap.set(els, { xPercent: -50, yPercent: -50, autoAlpha: 0 });

      let index = 0;
      let last = { x: 0, y: 0 };
      let zIndex = 1;
      const THRESHOLD = 90; // px entre una imagen y la siguiente

      const onMove = (e) => {
        const rect = wrap.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - last.x;
        const dy = y - last.y;
        if (Math.hypot(dx, dy) < THRESHOLD) return;
        last = { x, y };

        const el = els[index];
        index = (index + 1) % els.length;
        gsap.killTweensOf(el);
        gsap.set(el, { zIndex: zIndex++ });

        gsap
          .timeline()
          .fromTo(
            el,
            { x: x - dx * 0.4, y: y - dy * 0.4, scale: 0.3, rotation: gsap.utils.random(-12, 12), autoAlpha: 1 },
            { x, y, scale: 1, duration: 0.6, ease: "expo.out" }
          )
          .to(el, { y: "+=120", scale: 0.6, autoAlpha: 0, duration: 0.8, ease: "power2.in" }, 0.45);
      };

      const area = wrap.current;
      area.addEventListener("pointermove", onMove);
      return () => area.removeEventListener("pointermove", onMove);
    },
    { scope: wrap, dependencies: [images] }
  );

  return (
    <section ref={wrap} className="trail-section" data-cursor>
      <div className="trail-copy">
        <p className="eyebrow">Coral · 01 · Rastro de imágenes</p>
        <h2>Mueve el mouse por aquí</h2>
      </div>
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" className="trail-img" draggable={false} />
      ))}
    </section>
  );
}
