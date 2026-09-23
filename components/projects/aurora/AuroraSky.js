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
 * AURORA A — Cortinas de aurora boreal con un fragment shader.
 * Cada "cortina" es una franja cuya altura base sigue una curva de ruido.
 * Desde esa línea el brillo se desvanece hacia arriba y un segundo ruido muy
 * estirado en vertical dibuja los "rayos". Se suman 4 capas con colores
 * distintos, estrellas (hash por celda) y una silueta de montañas (ruido 1D).
 * - El mouse desplaza las cortinas horizontalmente (parallax por capa).
 * - El scroll cambia la paleta de verde a violeta/rosa.
 */
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;
  uniform float uScroll;
  varying vec2 vUv;

  ${simplexNoise3D}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    float t = uTime;

    // Cielo de fondo
    vec3 col = mix(vec3(0.01, 0.02, 0.05), vec3(0.02, 0.05, 0.12), uv.y);

    // Estrellas: una por celda de la cuadrícula, con parpadeo
    vec2 grid = vec2(uv.x * aspect, uv.y) * 90.0;
    vec2 cell = floor(grid);
    float star = hash(cell);
    float twinkle = 0.6 + 0.4 * sin(t * 2.0 + star * 40.0);
    float d = length(fract(grid) - 0.5);
    col += step(0.985, star) * smoothstep(0.12, 0.0, d) * twinkle * 0.9;

    // Paletas de la aurora (abajo / arriba) que cambian con el scroll
    vec3 low  = mix(vec3(0.15, 1.0, 0.55), vec3(0.95, 0.35, 0.75), uScroll);
    vec3 high = mix(vec3(0.45, 0.25, 1.0), vec3(0.35, 0.55, 1.0), uScroll);

    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float x = uv.x * aspect * (0.8 + fi * 0.15) + fi * 1.7 + uMouse.x * (0.15 + fi * 0.08);
      float base = 0.3 + fi * 0.08 + snoise(vec3(x * 0.9, fi * 3.1, t * 0.08)) * 0.12;
      float dy = uv.y - base;

      // Borde inferior nítido, se desvanece hacia arriba
      float curtain = smoothstep(-0.01, 0.015, dy) * exp(-max(dy, 0.0) * (3.2 - fi * 0.4));
      // Rayos verticales: ruido muy estirado en y
      float rays = pow(0.5 + 0.5 * snoise(vec3(x * 14.0, dy * 0.6 - t * 0.15, t * 0.25 + fi)), 1.5) * 1.6;
      // Ondulación que recorre la cortina
      float ripple = 0.75 + 0.25 * sin(x * 6.0 - t * 1.2 + fi);

      vec3 c = mix(low, high, clamp(dy * 2.2, 0.0, 1.0));
      col += c * curtain * rays * ripple * (0.75 - fi * 0.12);
    }

    // Montañas en primer plano
    float mx = uv.x * aspect;
    float ridge = 0.16 + snoise(vec3(mx * 1.5, 0.0, 0.0)) * 0.05 + snoise(vec3(mx * 5.0, 1.0, 0.0)) * 0.015;
    float mountain = smoothstep(ridge + 0.003, ridge - 0.003, uv.y);
    col = mix(col, vec3(0.005, 0.008, 0.015), mountain);

    // Reflejo tenue de la aurora sobre las montañas
    col += low * mountain * 0.04 * (1.0 - uv.y / ridge);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export default function AuroraSky() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uScroll: { value: 0 },
      };
      stage.scene.add(
        new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }))
      );

      const reduced = prefersReducedMotion();
      stage.add({
        onFrame: (t) => (uniforms.uTime.value = reduced ? 20 : t),
        onResize: (w, h) => uniforms.uResolution.value.set(w, h),
      });

      const toX = gsap.quickTo(uniforms.uMouse.value, "x", { duration: 2, ease: "power3.out" });
      const onMove = (e) => toX((e.clientX / window.innerWidth) * 2 - 1);
      window.addEventListener("pointermove", onMove);

      // Paleta según el scroll mientras la sección cruza la pantalla
      gsap.to(uniforms.uScroll, {
        value: 1,
        ease: "none",
        scrollTrigger: { trigger: wrap.current, start: "top bottom", end: "bottom top", scrub: true },
      });

      // Texto que entra al llegar a la sección
      gsap.from(".aurora-copy > *", {
        y: 40,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: wrap.current, start: "top 60%" },
      });

      return () => {
        window.removeEventListener("pointermove", onMove);
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="aurora-sky">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="aurora-copy">
        <p className="eyebrow">Aurora · 01 · Shader de aurora boreal</p>
        <h2>Un cielo que nunca se repite</h2>
        <p>Cuatro capas de ruido dibujan las cortinas. Mueve el mouse y haz scroll para cambiar la paleta.</p>
      </div>
    </section>
  );
}
