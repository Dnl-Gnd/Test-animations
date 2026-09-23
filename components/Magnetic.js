"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

/**
 * Botón magnético: mientras el mouse está encima, el elemento se desplaza hacia
 * el puntero (gsap.quickTo). Al salir vuelve a su lugar con un rebote elástico.
 * El contenido interno se mueve un poco más que el borde, lo que da profundidad.
 */
export default function Magnetic({ children, strength = 0.35, className = "" }) {
  const root = useRef(null);
  const inner = useRef(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!window.matchMedia("(pointer: fine)").matches) return;

      const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
      const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
      const ix = gsap.quickTo(inner.current, "x", { duration: 0.6, ease: "power3.out" });
      const iy = gsap.quickTo(inner.current, "y", { duration: 0.6, ease: "power3.out" });

      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        x(dx * strength);
        y(dy * strength);
        ix(dx * strength * 0.5);
        iy(dy * strength * 0.5);
      };
      const onLeave = () => {
        gsap.to([el, inner.current], { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.35)" });
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      return () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      };
    },
    { scope: root }
  );

  return (
    <span ref={root} className={`magnetic ${className}`}>
      <span ref={inner} className="magnetic-inner">
        {children}
      </span>
    </span>
  );
}
