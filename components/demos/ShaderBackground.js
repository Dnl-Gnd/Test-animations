"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";

gsap.registerPlugin(ScrollTrigger);

/**
 * DEMO 1 — Fondo fluido con shader (domain warping).
 * No hay ningún modelo 3D: es un solo rectángulo que cubre la pantalla y un
 * fragment shader que calcula el color de cada píxel con ruido fractal (fbm).
 * - El mouse deforma el flujo (suavizado con gsap.quickTo).
 * - El scroll cambia la paleta y "aleja" el ruido (ScrollTrigger con scrub).
 */
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;     // -1..1
  uniform float uScroll;    // 0..1
  varying vec2 vUv;

  ${simplexNoise3D}

  // fbm = varias capas de ruido sumadas, cada una más fina y más débil
  float fbm(vec3 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amp * snoise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    // Influencia del mouse: empuja el espacio alrededor del cursor
    vec2 m = uMouse * vec2(uResolution.x / uResolution.y, 1.0);
    float d = length(uv - m);
    uv += (uv - m) * 0.25 * exp(-d * 2.5);

    float t = uTime * 0.08;
    float zoom = 0.55 + uScroll * 0.6;

    // Domain warping: el ruido deforma las coordenadas de otro ruido
    vec2 q = vec2(fbm(vec3(uv * zoom, t)), fbm(vec3(uv * zoom + 5.2, t)));
    vec2 r = vec2(
      fbm(vec3(uv * zoom + 2.5 * q + vec2(1.7, 9.2), t * 1.3)),
      fbm(vec3(uv * zoom + 2.5 * q + vec2(8.3, 2.8), t * 1.3))
    );
    float f = fbm(vec3(uv * zoom + 2.5 * r, t));

    // Dos paletas que se mezclan con el scroll
    vec3 a1 = vec3(0.02, 0.02, 0.06), b1 = vec3(0.35, 0.10, 0.85), c1 = vec3(1.00, 0.45, 0.25);
    vec3 a2 = vec3(0.00, 0.04, 0.05), b2 = vec3(0.05, 0.55, 0.60), c2 = vec3(0.85, 0.95, 0.60);
    vec3 a = mix(a1, a2, uScroll), b = mix(b1, b2, uScroll), c = mix(c1, c2, uScroll);

    vec3 color = mix(a, b, clamp(f * f * 3.0, 0.0, 1.0));
    color = mix(color, c, clamp(length(q) * 0.9, 0.0, 1.0) * 0.6);
    color += c * pow(clamp(r.x, 0.0, 1.0), 3.0) * 0.5;

    // Viñeta para oscurecer los bordes
    color *= 1.0 - 0.35 * dot(vUv - 0.5, vUv - 0.5) * 2.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export default function ShaderBackground() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      // Resolución interna menor: el shader es pesado y el resultado es difuso
      stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));

      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uScroll: { value: 0 },
      };
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
      );
      stage.scene.add(mesh);

      const reduced = prefersReducedMotion();
      stage.add({
        onFrame: (t) => (uniforms.uTime.value = reduced ? 10 : t),
        onResize: (w, h) => uniforms.uResolution.value.set(w, h),
      });

      // Mouse suavizado: quickTo interpola hacia el valor nuevo con inercia
      const mouse = uniforms.uMouse.value;
      const toX = gsap.quickTo(mouse, "x", { duration: 1.2, ease: "power3.out" });
      const toY = gsap.quickTo(mouse, "y", { duration: 1.2, ease: "power3.out" });
      const onMove = (e) => {
        const rect = canvasBox.current.getBoundingClientRect();
        toX(((e.clientX - rect.left) / rect.width) * 2 - 1);
        toY(-(((e.clientY - rect.top) / rect.height) * 2 - 1));
      };
      window.addEventListener("pointermove", onMove);

      // Scroll -> uniform (0 a 1 mientras la sección sale de pantalla)
      gsap.to(uniforms.uScroll, {
        value: 1,
        ease: "none",
        scrollTrigger: { trigger: wrap.current, start: "top top", end: "bottom top", scrub: true },
      });

      // Entrada del texto
      gsap.from(".hero-line", { yPercent: 110, duration: 1.2, stagger: 0.12, ease: "expo.out", delay: 0.2 });

      return () => {
        window.removeEventListener("pointermove", onMove);
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="hero">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="hero-content">
        <p className="eyebrow">Demo 01 · Shader de fondo</p>
        <h1>
          <span className="line-mask"><span className="hero-line">Fondos 3D</span></span>
          <span className="line-mask"><span className="hero-line">hechos con código</span></span>
        </h1>
        <p className="hero-sub">Mueve el mouse y haz scroll.</p>
      </div>
    </section>
  );
}
