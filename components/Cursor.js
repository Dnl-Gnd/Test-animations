"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Cursor personalizado: un punto que sigue al mouse casi al instante y un anillo
 * que llega con retraso (dos gsap.quickTo con duraciones distintas).
 * - Sobre enlaces/botones o elementos con [data-cursor] el anillo crece.
 * - Con [data-cursor-label="Texto"] (o setCursor("Texto") desde WebGL) muestra texto.
 * Se desactiva en pantallas táctiles.
 */
const EVENT = "cursor:label";

/** Permite cambiar la etiqueta del cursor desde cualquier parte (p. ej. un raycast) */
export function setCursor(label) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: label }));
}

export default function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const text = useRef(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.documentElement.classList.add("has-cursor");

    const dotX = gsap.quickTo(dot.current, "x", { duration: 0.12, ease: "power3.out" });
    const dotY = gsap.quickTo(dot.current, "y", { duration: 0.12, ease: "power3.out" });
    const ringX = gsap.quickTo(ring.current, "x", { duration: 0.55, ease: "power3.out" });
    const ringY = gsap.quickTo(ring.current, "y", { duration: 0.55, ease: "power3.out" });

    gsap.set([dot.current, ring.current], { xPercent: -50, yPercent: -50, autoAlpha: 0 });

    let visible = false;
    let domLabel = null; // etiqueta por atributo HTML
    let glLabel = null; // etiqueta enviada con setCursor()

    const render = (hovering) => {
      const label = glLabel ?? domLabel;
      text.current.textContent = label ?? "";
      gsap.to(ring.current, {
        // Se anima el tamaño (no scale) para que el texto no se vea borroso
        width: label ? 96 : hovering ? 64 : 40,
        height: label ? 96 : hovering ? 64 : 40,
        scale: 1,
        backgroundColor: label ? "rgba(255,138,92,0.95)" : "rgba(255,255,255,0)",
        borderColor: label ? "rgba(255,138,92,0)" : "rgba(255,255,255,0.6)",
        duration: 0.4,
        ease: "power3.out",
      });
      gsap.to(text.current, { autoAlpha: label ? 1 : 0, duration: 0.2 });
      gsap.to(dot.current, { scale: label || hovering ? 0 : 1, duration: 0.3 });
    };

    let hovering = false;
    const onMove = (e) => {
      if (!visible) {
        visible = true;
        gsap.set([dot.current, ring.current], { x: e.clientX, y: e.clientY });
        gsap.to([dot.current, ring.current], { autoAlpha: 1, duration: 0.3 });
      }
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    };

    const onOver = (e) => {
      const el = e.target.closest("a, button, [data-cursor], [data-cursor-label]");
      const nextHover = !!el;
      const nextLabel = el?.dataset.cursorLabel ?? null;
      if (nextHover !== hovering || nextLabel !== domLabel) {
        hovering = nextHover;
        domLabel = nextLabel;
        render(hovering);
      }
    };

    const onLabel = (e) => {
      glLabel = e.detail;
      render(hovering);
    };

    // Al cambiar de página el elemento bajo el mouse desaparece: se limpia el estado
    const onReset = () => {
      hovering = false;
      domLabel = null;
      glLabel = null;
      render(false);
    };

    const onDown = () => gsap.to(ring.current, { scale: 0.85, duration: 0.15 });
    const onUp = () => render(hovering);
    const onLeaveWindow = () => {
      visible = false;
      gsap.to([dot.current, ring.current], { autoAlpha: 0, duration: 0.3 });
    };

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerover", onOver);
    window.addEventListener(EVENT, onLabel);
    window.addEventListener("cursor:reset", onReset);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);

    return () => {
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener(EVENT, onLabel);
      window.removeEventListener("cursor:reset", onReset);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
    };
  }, []);

  return (
    <div className="cursor" aria-hidden="true">
      <div ref={ring} className="cursor-ring">
        <span ref={text} className="cursor-text" />
      </div>
      <div ref={dot} className="cursor-dot" />
    </div>
  );
}
