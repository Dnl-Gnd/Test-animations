import * as THREE from "three";
import { gsap } from "gsap";

/**
 * Crea un "escenario" Three.js dentro de un contenedor:
 * renderer + escena + resize + loop sincronizado con gsap.ticker
 * (el mismo reloj que usan Lenis y ScrollTrigger, así todo se mueve en el mismo frame).
 * El loop se pausa solo cuando el canvas no está en pantalla.
 */
export function createStage(container, { camera, alpha = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const frameCallbacks = new Set();
  const start = performance.now();

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    if (camera.isPerspectiveCamera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    frameCallbacks.forEach((cb) => cb.onResize?.(w, h));
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function tick() {
    const elapsed = (performance.now() - start) / 1000;
    frameCallbacks.forEach((cb) => cb.onFrame?.(elapsed));
    renderer.render(scene, camera);
  }

  // Solo renderiza cuando el canvas es visible (ahorra GPU y batería).
  let running = false;
  const io = new IntersectionObserver((entries) => {
    // Puede llegar más de un registro en el mismo callback: el último es el estado actual
    const entry = entries[entries.length - 1];
    if (entry.isIntersecting && !running) {
      gsap.ticker.add(tick);
      running = true;
    } else if (!entry.isIntersecting && running) {
      gsap.ticker.remove(tick);
      running = false;
    }
  });
  io.observe(container);

  resize();

  return {
    renderer,
    scene,
    camera,
    /** Registra { onFrame(time), onResize(w, h) } */
    add(cb) {
      frameCallbacks.add(cb);
      cb.onResize?.(container.clientWidth, container.clientHeight);
    },
    destroy() {
      gsap.ticker.remove(tick);
      io.disconnect();
      ro.disconnect();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        obj.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
