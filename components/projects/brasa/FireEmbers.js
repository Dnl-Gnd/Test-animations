"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";

gsap.registerPlugin(ScrollTrigger);

const EMBERS = 1400;

/**
 * BRASA A — Fuego y chispas con shaders.
 * - Fuego: fragment shader a pantalla completa. Un ruido fractal que sube con el
 *   tiempo se recorta con un degradado vertical (más fuego abajo) y se pinta con
 *   una rampa de color negro → rojo → naranja → amarillo → blanco.
 * - El mouse es una fuente de calor: las llamas se inclinan hacia él y se
 *   intensifican a su alrededor.
 * - Chispas: puntos cuya posición se calcula entera en el vertex shader
 *   (suben en bucle, oscilan con ruido y el mouse las empuja como viento).
 * - El scroll aviva el fuego (uIntensity) mientras la sección cruza la pantalla.
 */
const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fireFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;       // 0..1
  uniform float uAspect;
  uniform float uIntensity;
  varying vec2 vUv;

  ${simplexNoise3D}

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * snoise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  vec3 fireRamp(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(vec3(0.0), vec3(0.55, 0.03, 0.02), smoothstep(0.0, 0.3, t));
    c = mix(c, vec3(1.0, 0.35, 0.05), smoothstep(0.3, 0.6, t));
    c = mix(c, vec3(1.0, 0.8, 0.3), smoothstep(0.6, 0.85, t));
    c = mix(c, vec3(1.0, 1.0, 0.9), smoothstep(0.85, 1.0, t));
    return c;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = vec2(uv.x * uAspect, uv.y);
    vec2 m = vec2(uMouse.x * uAspect, uMouse.y);

    // Las llamas se inclinan hacia el mouse
    float lean = (m.x - p.x) * 0.25 * uv.y;
    p.x += lean;

    float t = uTime;
    float n = fbm(vec3(p.x * 2.2, p.y * 1.6 - t * 1.1, t * 0.2));
    float n2 = fbm(vec3(p.x * 5.0, p.y * 3.0 - t * 2.0, 3.0));

    // Forma: base ancha abajo, se apaga hacia arriba
    float height = 0.55 * uIntensity + 0.12 * n2;
    float shape = 1.0 - smoothstep(0.0, height, uv.y - n * 0.18);

    // Calor extra alrededor del mouse
    float heat = smoothstep(0.35, 0.0, distance(p, m)) * 0.55;

    float fire = shape * (0.7 + 0.5 * n) + heat * (0.6 + 0.4 * n2);
    vec3 col = fireRamp(fire);

    // Brillo ambiente rojizo desde abajo
    col += vec3(0.25, 0.03, 0.02) * (1.0 - uv.y) * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const emberVertex = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;       // -1..1
  uniform float uPixelRatio;
  attribute float aRandom;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vLife;

  ${simplexNoise3D}

  void main() {
    // Vida de 0 a 1 en bucle: nace abajo, muere arriba
    float life = fract(uTime * aSpeed + aOffset);
    float y = -1.1 + life * 2.4;
    float x = (aRandom * 2.0 - 1.0) * 0.9;
    x += snoise(vec3(aRandom * 10.0, life * 2.0, uTime * 0.2)) * 0.15 * life;

    // Viento: el mouse empuja las chispas cercanas
    vec2 pos = vec2(x, y);
    vec2 d = pos - uMouse;
    pos += normalize(d + 0.0001) * smoothstep(0.35, 0.0, length(d)) * 0.25;

    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = (2.0 + aRandom * 4.0) * uPixelRatio * (1.0 - life * 0.6);
    vLife = life;
  }
`;

const emberFragment = /* glsl */ `
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.25, 0.05), vLife);
    float fade = smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.7, 1.0, vLife));
    gl_FragColor = vec4(col * a, a * fade);
  }
`;

export default function FireEmbers() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

      const fireUniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.2) },
        uAspect: { value: 1 },
        uIntensity: { value: 0.6 },
      };
      stage.scene.add(
        new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: fireUniforms, vertexShader: quadVertex, fragmentShader: fireFragment }))
      );

      const rnd = new Float32Array(EMBERS);
      const speed = new Float32Array(EMBERS);
      const offset = new Float32Array(EMBERS);
      for (let i = 0; i < EMBERS; i++) {
        rnd[i] = Math.random();
        speed[i] = 0.12 + Math.random() * 0.25;
        offset[i] = Math.random();
      }
      const emberGeo = new THREE.BufferGeometry();
      emberGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
      emberGeo.setAttribute("aRandom", new THREE.BufferAttribute(rnd, 1));
      emberGeo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
      emberGeo.setAttribute("aOffset", new THREE.BufferAttribute(offset, 1));
      const emberUniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, -0.6) },
        uPixelRatio: { value: stage.renderer.getPixelRatio() },
      };
      const embers = new THREE.Points(
        emberGeo,
        new THREE.ShaderMaterial({
          uniforms: emberUniforms,
          vertexShader: emberVertex,
          fragmentShader: emberFragment,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        })
      );
      embers.frustumCulled = false;
      stage.scene.add(embers);

      // Mouse suavizado (el fuego reacciona con un poco de retraso)
      const mouse = { x: 0.5, y: 0.2 };
      const toX = gsap.quickTo(mouse, "x", { duration: 0.8, ease: "power3.out" });
      const toY = gsap.quickTo(mouse, "y", { duration: 0.8, ease: "power3.out" });
      const onMove = (e) => {
        const r = canvasBox.current.getBoundingClientRect();
        toX((e.clientX - r.left) / r.width);
        toY(1 - (e.clientY - r.top) / r.height);
      };
      window.addEventListener("pointermove", onMove);

      const reduced = prefersReducedMotion();
      stage.add({
        onResize: (w, h) => {
          fireUniforms.uAspect.value = w / h;
        },
        onFrame: (t) => {
          const time = reduced ? 0 : t;
          fireUniforms.uTime.value = time;
          emberUniforms.uTime.value = time;
          fireUniforms.uMouse.value.set(mouse.x, mouse.y);
          emberUniforms.uMouse.value.set(mouse.x * 2 - 1, mouse.y * 2 - 1);
        },
      });

      gsap.fromTo(
        fireUniforms.uIntensity,
        { value: 0.45 },
        { value: 1.2, ease: "none", scrollTrigger: { trigger: wrap.current, start: "top bottom", end: "bottom top", scrub: true } }
      );

      gsap.from(".fire-copy > *", {
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
    <section ref={wrap} className="fire-section">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="fire-copy">
        <p className="eyebrow">Brasa · 01 · Fuego con shaders</p>
        <h2>Acerca el mouse a las llamas</h2>
        <p>Haz scroll para avivar el fuego.</p>
      </div>
    </section>
  );
}
