"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getLenis } from "@/components/SmoothScroll";

/**
 * Transición entre páginas con GSAP + App Router de Next.js.
 * 1. Al hacer clic en <TransitionLink>, unas columnas cubren la pantalla (salida).
 * 2. Con la pantalla cubierta se llama a router.push() y Next cambia la página.
 * 3. Cuando cambia la ruta (usePathname), se sube el scroll y las columnas se
 *    retiran hacia arriba (entrada).
 */
const TransitionContext = createContext({ navigate: () => {} });
const COLUMNS = 5;

export function PageTransitionProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const overlay = useRef(null);
  const label = useRef(null);
  const busy = useRef(false);
  const pending = useRef(false);

  const navigate = useCallback(
    (href, text = "") => {
      if (busy.current || href === pathname) return;
      busy.current = true;
      label.current.textContent = text;
      const cols = overlay.current.querySelectorAll(".pt-col");

      gsap
        .timeline({
          onComplete: () => {
            pending.current = true;
            router.push(href, { scroll: false });
          },
        })
        .set(overlay.current, { autoAlpha: 1 })
        .fromTo(
          cols,
          { scaleY: 0, transformOrigin: "50% 100%" },
          { scaleY: 1, duration: 0.6, ease: "power4.inOut", stagger: 0.06 }
        )
        .fromTo(label.current, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: "power3.out" }, "-=0.25");
    },
    [pathname, router]
  );

  // Entrada: se ejecuta cuando la página nueva ya está montada
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    window.dispatchEvent(new Event("cursor:reset"));

    getLenis()?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    ScrollTrigger.refresh();

    const cols = overlay.current.querySelectorAll(".pt-col");
    gsap
      .timeline({
        delay: 0.15,
        onComplete: () => {
          gsap.set(overlay.current, { autoAlpha: 0 });
          busy.current = false;
        },
      })
      .to(label.current, { yPercent: -100, autoAlpha: 0, duration: 0.3, ease: "power3.in" })
      .to(cols, { scaleY: 0, transformOrigin: "50% 0%", duration: 0.6, ease: "power4.inOut", stagger: 0.06 }, "-=0.1");
  }, [pathname]);

  return (
    <TransitionContext.Provider value={{ navigate }}>
      {children}
      <div ref={overlay} className="pt-overlay" aria-hidden="true">
        {Array.from({ length: COLUMNS }, (_, i) => (
          <span key={i} className="pt-col" />
        ))}
        <span className="pt-label-mask">
          <span ref={label} className="pt-label" />
        </span>
      </div>
    </TransitionContext.Provider>
  );
}

/** Reemplazo de <Link> que dispara la transición antes de navegar */
export function TransitionLink({ href, label, children, ...props }) {
  const { navigate } = useContext(TransitionContext);
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href, label);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
