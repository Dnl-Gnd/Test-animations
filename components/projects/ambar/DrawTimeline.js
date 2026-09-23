"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);

const MILESTONES = [
  { year: "2019", title: "Primer boceto", text: "Una paleta de dos colores y una idea: luz atrapada.", stat: 12, unit: "bocetos" },
  { year: "2021", title: "Sistema visual", text: "Tipografía, retícula y reglas de movimiento.", stat: 48, unit: "componentes" },
  { year: "2023", title: "Primer sitio", text: "La identidad sale a la web con WebGL.", stat: 120, unit: "mil visitas" },
  { year: "2025", title: "Premios", text: "Reconocimiento internacional al sistema de marca.", stat: 7, unit: "premios" },
  { year: "2026", title: "Hoy", text: "Una marca que se mueve, responde y se adapta.", stat: 100, unit: "% generativa" },
];

/**
 * ÁMBAR B — Línea de tiempo que se dibuja con el scroll.
 * - El camino SVG se calcula en JavaScript según el tamaño real de la sección
 *   (curvas que zigzaguean entre los hitos) y se recalcula al cambiar el tamaño.
 * - DrawSVGPlugin dibuja el trazo de 0% a 100% ligado al scroll (scrub).
 * - MotionPathPlugin mueve un punto brillante por el mismo camino.
 * - Cada hito aparece al acercarse y su número cuenta hasta el valor final.
 */
export default function DrawTimeline() {
  const wrap = useRef(null);
  const svg = useRef(null);
  const path = useRef(null);
  const glow = useRef(null);

  useGSAP(
    () => {
      const section = wrap.current;
      const items = gsap.utils.toArray(".tl-item", section);

      // Construye el camino pasando por el centro de cada nodo
      const build = () => {
        const box = section.getBoundingClientRect();
        svg.current.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
        const pts = items.map((el) => {
          const dot = el.querySelector(".tl-node").getBoundingClientRect();
          return { x: dot.left - box.left + dot.width / 2, y: dot.top - box.top + dot.height / 2 };
        });
        // Los nodos están en el centro; los puntos de control se alternan a
        // izquierda y derecha para que la línea serpentee entre los hitos
        const sway = Math.min(box.width * 0.22, 260);
        let d = `M ${box.width / 2} 0 C ${box.width / 2 + sway} ${pts[0].y * 0.4}, ${pts[0].x + sway} ${pts[0].y * 0.7}, ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const dir = i % 2 ? -1 : 1;
          const gap = b.y - a.y;
          d += ` C ${a.x + sway * dir} ${a.y + gap * 0.3}, ${b.x + sway * dir} ${b.y - gap * 0.3}, ${b.x} ${b.y}`;
        }
        const last = pts[pts.length - 1];
        d += ` C ${last.x} ${last.y + 120}, ${box.width / 2} ${box.height - 120}, ${box.width / 2} ${box.height}`;
        path.current.setAttribute("d", d);
        glow.current.setAttribute("d", d);
      };
      build();

      // Trazo + punto que recorre el camino, ligados al scroll
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 50%",
          end: "bottom 50%",
          scrub: 0.6,
          invalidateOnRefresh: true,
          onRefreshInit: build, // recalcula el camino al cambiar el tamaño
        },
      });
      tl.fromTo([path.current, glow.current], { drawSVG: "0%" }, { drawSVG: "100%", ease: "none" }, 0).to(
        ".tl-spark",
        {
          ease: "none",
          motionPath: { path: path.current, align: path.current, alignOrigin: [0.5, 0.5], autoRotate: false },
        },
        0
      );

      // Hitos: aparecen y cuentan su número
      items.forEach((el, i) => {
        const counter = el.querySelector(".tl-stat-num");
        const target = MILESTONES[i].stat;
        const obj = { v: 0 };
        gsap
          .timeline({ scrollTrigger: { trigger: el, start: "top 65%", toggleActions: "play none none reverse" } })
          .from(el.querySelector(".tl-node"), { scale: 0, duration: 0.5, ease: "back.out(3)" })
          .from(el.querySelectorAll(".tl-card > *"), { y: 30, autoAlpha: 0, stagger: 0.08, duration: 0.7, ease: "power3.out" }, 0.1)
          .to(obj, { v: target, duration: 1.4, ease: "power2.out", onUpdate: () => (counter.textContent = Math.round(obj.v)) }, 0.2);
      });
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="tl-section">
      <div className="tl-head">
        <p className="eyebrow">Ámbar · 02 · Línea que se dibuja con el scroll</p>
        <h2>Siete años en una sola línea</h2>
      </div>
      <svg ref={svg} className="tl-svg" aria-hidden="true">
        <path ref={glow} className="tl-path-glow" />
        <path ref={path} className="tl-path" />
      </svg>
      <span className="tl-spark" aria-hidden="true" />
      <ol className="tl-list">
        {MILESTONES.map((m, i) => (
          <li key={m.year} className={`tl-item ${i % 2 ? "is-right" : "is-left"}`}>
            <span className="tl-node" />
            <div className="tl-card">
              <span className="tl-year">{m.year}</span>
              <h3>{m.title}</h3>
              <p>{m.text}</p>
              <p className="tl-stat">
                <span className="tl-stat-num">0</span> {m.unit}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
