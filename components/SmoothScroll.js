"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Instancia compartida para que otras partes (transiciones de página) puedan usarla
let lenisInstance = null;
export const getLenis = () => lenisInstance;

/**
 * Scroll suave con Lenis, conectado al reloj de GSAP.
 * Es el mismo patrón que usa Trionn: Lenis avanza en gsap.ticker y avisa a
 * ScrollTrigger en cada frame, así el scroll y las animaciones nunca se desfasan.
 */
export default function SmoothScroll({ children }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.09 });
    lenisInstance = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  return children;
}
