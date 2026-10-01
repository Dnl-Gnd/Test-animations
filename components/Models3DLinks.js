"use client";

import { TransitionLink } from "@/components/PageTransition";
import { MODELS_3D } from "@/lib/models3d";

/**
 * Sección final del home: enlaces a las páginas internas de animaciones 3D.
 * Usa la misma transición de columnas que los proyectos de la demo 05.
 */
export default function Models3DLinks() {
  return (
    <section className="models3d">
      <div className="models3d-inner">
        <p className="eyebrow">Animaciones 3D</p>
        <h2>Explora los modelos</h2>

        <ul className="models3d-grid">
          {MODELS_3D.map((m, i) => (
            <li key={m.slug}>
              <TransitionLink
                href={`/3d/${m.slug}`}
                label={m.title}
                className={`model-card${m.ready ? "" : " is-pending"}`}
                data-cursor-label="Abrir"
                style={{ "--a": m.a, "--b": m.b }}
              >
                <span className="model-card-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="model-card-title">{m.title}</span>
                <span className="model-card-tag">{m.tag}</span>
              </TransitionLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
