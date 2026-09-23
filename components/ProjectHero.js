"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Magnetic from "@/components/Magnetic";
import { TransitionLink } from "@/components/PageTransition";

gsap.registerPlugin(SplitText);

/**
 * Página de proyecto. El título se divide en letras con SplitText y cada letra
 * sube desde una máscara cuando termina la transición de entrada.
 */
export default function ProjectHero({ project, next }) {
  const root = useRef(null);

  useGSAP(
    () => {
      const split = SplitText.create(".project-hero-title", { type: "chars", mask: "chars" });
      gsap
        .timeline({ delay: 0.75 })
        .from(split.chars, { yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.035 })
        .from(".project-hero-fade", { autoAlpha: 0, y: 20, duration: 0.8, stagger: 0.1, ease: "power3.out" }, "-=0.6");
      return () => split.revert();
    },
    { scope: root }
  );

  return (
    <main ref={root} className="project-page" style={{ "--a": project.a, "--b": project.b }}>
      <div className="project-bg" />
      <nav className="project-nav project-hero-fade">
        <Magnetic>
          <TransitionLink href="/" label="Inicio" className="btn btn-ghost">
            ← Volver al laboratorio
          </TransitionLink>
        </Magnetic>
      </nav>
      <div className="project-hero">
        <p className="eyebrow project-hero-fade">Proyecto · {project.year}</p>
        <h1 className="project-hero-title">{project.title}</h1>
        <p className="project-hero-text project-hero-fade">{project.text}</p>
      </div>
      <footer className="project-next project-hero-fade">
        <span className="eyebrow">Siguiente</span>
        <TransitionLink href={`/proyecto/${next.slug}`} label={next.title} className="project-next-link" data-cursor-label="Ir">
          {next.title}
        </TransitionLink>
      </footer>
    </main>
  );
}
