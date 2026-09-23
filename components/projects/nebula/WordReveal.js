"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * NÉBULA B — Scroll narrativo: el texto se "enciende" palabra por palabra.
 * SplitText divide el párrafo en palabras. Un tween con stagger y scrub las pasa
 * de opacidad 0.12 a 1 a medida que el párrafo cruza la pantalla, así el
 * lector avanza al ritmo de su scroll. Las palabras marcadas con <em> además
 * cambian de color y se desenfocan al entrar.
 */

export default function WordReveal() {
  const wrap = useRef(null);

  useGSAP(
    () => {
      const split = SplitText.create(".reveal-text", { type: "words", wordsClass: "reveal-word" });

      gsap.fromTo(
        split.words,
        { opacity: 0.12 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: { trigger: ".reveal-text", start: "top 75%", end: "bottom 45%", scrub: true },
        }
      );

      // Palabras destacadas: color + desenfoque al entrar
      gsap.utils.toArray(".reveal-text em").forEach((el) => {
        gsap.fromTo(
          el,
          { color: "#9b99ad", filter: "blur(6px)" },
          {
            color: "#7cffd4",
            filter: "blur(0px)",
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 70%", end: "top 45%", scrub: true },
          }
        );
      });

      return () => split.revert();
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="reveal-section">
      <p className="eyebrow">Nébula · 02 · Texto que se revela con el scroll</p>
      <p className="reveal-text">
        Nébula es un sitio que cuenta una historia mientras haces scroll. Cada sección responde a tu
        ritmo: si avanzas lento, el universo <em>se expande despacio</em>; si corres, <em>las estrellas</em> se
        encienden de golpe. Así el texto deja de ser un bloque y se convierte en parte de la animación.
      </p>
    </section>
  );
}
