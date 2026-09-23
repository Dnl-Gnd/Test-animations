"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(Flip, ScrollTrigger);

const ITEMS = [
  { name: "Perito Moreno", tag: "hielo", km: "250 km²" },
  { name: "Vatnajökull", tag: "hielo", km: "7 700 km²" },
  { name: "Nevado Sajama", tag: "nieve", km: "6 542 m" },
  { name: "Lago Baikal", tag: "agua", km: "31 500 km²" },
  { name: "Aletsch", tag: "hielo", km: "81 km²" },
  { name: "Denali", tag: "nieve", km: "6 190 m" },
  { name: "Mar de Weddell", tag: "agua", km: "2,8 M km²" },
  { name: "Mont Blanc", tag: "nieve", km: "4 806 m" },
];
const FILTERS = ["todos", "hielo", "nieve", "agua"];

/**
 * GLACIAR B — Tarjetas de vidrio esmerilado con GSAP Flip.
 * Flip ("First, Last, Invert, Play") guarda la posición de cada tarjeta, deja
 * que React cambie el layout (cuadrícula ↔ lista, o filtros) y anima cada
 * tarjeta desde donde estaba hasta su lugar nuevo, aunque el cambio real sea
 * instantáneo en el CSS.
 * - Las tarjetas que se ocultan (display: none) salen con onLeave y las que
 *   vuelven entran con onEnter.
 * - El efecto de vidrio es CSS: backdrop-filter sobre manchas de color que se
 *   mueven lentamente detrás.
 */
export default function FlipGrid() {
  const wrap = useRef(null);
  const flipState = useRef(null);
  const [layout, setLayout] = useState("grid");
  const [filter, setFilter] = useState("todos");

  // Antes de cambiar el estado, se guarda la posición actual de las tarjetas
  const capture = () => {
    // Incluye el contenedor para que su altura también se anime (si no, la
    // sección "salta" mientras las tarjetas están en posición absoluta)
    flipState.current = Flip.getState(".flip-card, .flip-list", { props: "borderRadius" });
  };

  // Después del render, Flip anima desde la posición guardada
  useGSAP(
    () => {
      if (!flipState.current) return;
      Flip.from(flipState.current, {
        duration: 0.8,
        ease: "power3.inOut",
        stagger: 0.03,
        // Solo las tarjetas pasan a posición absoluta durante la animación;
        // la lista anima su altura para que la sección no salte
        absolute: ".flip-card",
        nested: true,
        targets: ".flip-card, .flip-list",
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.2 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.6, duration: 0.4 }),
      });
      flipState.current = null;
    },
    { scope: wrap, dependencies: [layout, filter] }
  );

  // Entrada inicial de las tarjetas al llegar a la sección
  useGSAP(
    () => {
      gsap.from(".flip-card", {
        y: 60,
        autoAlpha: 0,
        stagger: 0.06,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: ".flip-list", start: "top 80%" },
      });
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="flip-section">
      <div className="flip-blobs" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="flip-inner">
        <p className="eyebrow">Glaciar · 02 · Cuadrícula ↔ lista con Flip</p>
        <h2>Cambia la vista o filtra</h2>

        <div className="flip-controls">
          <div className="flip-group" role="group" aria-label="Vista">
            {["grid", "list"].map((l) => (
              <button
                key={l}
                type="button"
                className={`flip-btn ${layout === l ? "is-active" : ""}`}
                onClick={() => {
                  if (l === layout) return;
                  capture();
                  setLayout(l);
                }}
              >
                {l === "grid" ? "Cuadrícula" : "Lista"}
              </button>
            ))}
          </div>
          <div className="flip-group" role="group" aria-label="Filtro">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`flip-btn ${filter === f ? "is-active" : ""}`}
                onClick={() => {
                  if (f === filter) return;
                  capture();
                  setFilter(f);
                }}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <ul className={`flip-list is-${layout}`} data-flip-id="flip-list">
          {ITEMS.map((it) => (
            <li
              key={it.name}
              className="flip-card"
              data-flip-id={it.name}
              style={{ display: filter === "todos" || filter === it.tag ? undefined : "none" }}
            >
              <span className={`flip-tag tag-${it.tag}`}>{it.tag}</span>
              <span className="flip-name">{it.name}</span>
              <span className="flip-km">{it.km}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
