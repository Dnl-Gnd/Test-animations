"use client";

import Magnetic from "@/components/Magnetic";
import { TransitionLink } from "@/components/PageTransition";
import { PROJECTS } from "@/lib/projects";

/**
 * DEMO 05 — Transiciones entre páginas, cursor y botones magnéticos.
 * Cada proyecto es un <TransitionLink>: al hacer clic, las columnas cubren la
 * pantalla, Next.js cambia de ruta y las columnas se retiran.
 * data-cursor-label="Abrir" hace que el cursor muestre texto al pasar encima.
 */
export default function TransitionsDemo() {
  return (
    <section className="transitions">
      <div className="transitions-inner">
        <p className="eyebrow">Demo 05 · Transiciones y cursor</p>
        <h2>Abre un proyecto</h2>

        <ul className="project-list">
          {PROJECTS.map((p) => (
            <li key={p.slug}>
              <TransitionLink
                href={`/proyecto/${p.slug}`}
                label={p.title}
                className="project-row"
                data-cursor-label="Abrir"
                style={{ "--a": p.a, "--b": p.b }}
              >
                <span className="project-title">{p.title}</span>
                <span className="project-meta">{p.year}</span>
              </TransitionLink>
            </li>
          ))}
        </ul>

        <div className="magnetic-row">
          <Magnetic>
            <TransitionLink href="/proyecto/aurora" label="Aurora" className="btn btn-solid">
              Ver proyecto destacado
            </TransitionLink>
          </Magnetic>
          <Magnetic strength={0.5}>
            <button type="button" className="btn btn-round" aria-label="Botón magnético de ejemplo">
              ↗
            </button>
          </Magnetic>
          <Magnetic strength={0.25}>
            <a href="https://gsap.com/docs/v3/" target="_blank" rel="noreferrer" className="btn btn-ghost">
              Documentación de GSAP
            </a>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
