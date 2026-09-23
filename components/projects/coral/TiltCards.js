"use client";

import { useRef, useState, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { artDataURL } from "@/lib/art";

gsap.registerPlugin(ScrollTrigger);

const PRODUCTS = [
  { name: "Lámpara Coral", price: "$120", a: "#ff4f7b", b: "#ffd36b" },
  { name: "Silla Arrecife", price: "$340", a: "#ff8a5c", b: "#3a0f5c" },
  { name: "Jarrón Marea", price: "$85", a: "#0f7c8c", b: "#ffb38a" },
];

/**
 * CORAL B — Tarjetas de producto con inclinación 3D y reflejo.
 * - Entrada: ScrollTrigger.batch anima las tarjetas en grupo cuando aparecen.
 * - Hover: la posición del mouse dentro de la tarjeta se convierte en rotateX /
 *   rotateY (gsap.quickTo con transformPerspective). La imagen interna se mueve
 *   en sentido contrario (parallax) y un brillo radial sigue al puntero
 *   mediante variables CSS.
 * - Al salir, vuelve a su posición con un rebote elástico.
 */
export default function TiltCards() {
  const wrap = useRef(null);
  const [images, setImages] = useState([]);

  useEffect(() => {
    setImages(PRODUCTS.map((p, i) => artDataURL({ a: p.a, b: p.b, seed: i + 3, width: 600, height: 720 })));
  }, []);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray(".tilt-card", wrap.current);
      gsap.set(cards, { transformPerspective: 900 });

      // Entrada escalonada al hacer scroll
      gsap.set(cards, { y: 80, autoAlpha: 0 });
      ScrollTrigger.batch(cards, {
        start: "top 85%",
        onEnter: (batch) =>
          gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.12, ease: "power3.out", overwrite: true }),
      });

      if (!window.matchMedia("(pointer: fine)").matches) return;

      const cleanups = cards.map((card) => {
        const media = card.querySelector(".tilt-media");
        const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
        const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
        const mx = gsap.quickTo(media, "x", { duration: 0.5, ease: "power3.out" });
        const my = gsap.quickTo(media, "y", { duration: 0.5, ease: "power3.out" });

        const onMove = (e) => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width; // 0..1
          const py = (e.clientY - r.top) / r.height;
          rx((0.5 - py) * 18);
          ry((px - 0.5) * 22);
          mx((0.5 - px) * 24);
          my((0.5 - py) * 24);
          card.style.setProperty("--gx", `${px * 100}%`);
          card.style.setProperty("--gy", `${py * 100}%`);
        };
        const onEnter = () => gsap.to(card, { scale: 1.03, duration: 0.4, ease: "power3.out" });
        const onLeave = () => {
          gsap.to(card, { rotationX: 0, rotationY: 0, scale: 1, duration: 1.2, ease: "elastic.out(1, 0.4)" });
          gsap.to(media, { x: 0, y: 0, duration: 1.2, ease: "elastic.out(1, 0.4)" });
        };

        card.addEventListener("pointermove", onMove);
        card.addEventListener("pointerenter", onEnter);
        card.addEventListener("pointerleave", onLeave);
        return () => {
          card.removeEventListener("pointermove", onMove);
          card.removeEventListener("pointerenter", onEnter);
          card.removeEventListener("pointerleave", onLeave);
        };
      });

      return () => cleanups.forEach((fn) => fn());
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="tilt-section">
      <div className="tilt-head">
        <p className="eyebrow">Coral · 02 · Tarjetas con inclinación 3D</p>
        <h2>Pasa el mouse sobre los productos</h2>
      </div>
      <div className="tilt-grid">
        {PRODUCTS.map((p, i) => (
          <article key={p.name} className="tilt-card" data-cursor-label="Comprar">
            <div className="tilt-frame">
              <div
                className="tilt-media"
                style={{ backgroundImage: images[i] ? `url(${images[i]})` : `linear-gradient(135deg, ${p.a}, ${p.b})` }}
              />
              <div className="tilt-glare" />
            </div>
            <div className="tilt-info">
              <span>{p.name}</span>
              <span className="tilt-price">{p.price}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
