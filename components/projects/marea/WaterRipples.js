"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";

gsap.registerPlugin(ScrollTrigger);

const SIM = 256; // resolución de la simulación (256 x 256 celdas)

/**
 * MAREA A — Superficie de agua simulada en la GPU.
 * La altura del agua vive en una textura. En cada frame un shader calcula la
 * altura nueva de cada celda con la ecuación de onda (promedio de los vecinos
 * menos la altura anterior) y la escribe en otra textura: se alternan dos
 * render targets ("ping-pong"). El mouse suma un impulso donde pasa y cada
 * cierto tiempo cae una gota al azar.
 * Un segundo shader lee esa altura, calcula la normal y la usa para refractar
 * el fondo (azulejos de piscina) y dibujar reflejos de luz.
 */
const simVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const simFragment = /* glsl */ `
  uniform sampler2D uState;   // r = altura actual, g = altura anterior
  uniform vec2  uTexel;
  uniform vec2  uMouse;       // 0..1
  uniform float uMouseForce;
  uniform vec3  uDrop;        // xy = posición, z = fuerza
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    vec4 s = texture2D(uState, vUv);
    float h = s.r;
    float prev = s.g;

    // Ecuación de onda discreta
    float n = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r
            + texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r
            + texture2D(uState, vUv + vec2(0.0, uTexel.y)).r
            + texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
    float next = n * 0.5 - prev;
    next *= 0.985; // amortiguación: las ondas se apagan poco a poco

    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    float dm = distance(p, vec2(uMouse.x * uAspect, uMouse.y));
    next += smoothstep(0.035, 0.0, dm) * uMouseForce;

    float dd = distance(p, vec2(uDrop.x * uAspect, uDrop.y));
    next += smoothstep(0.02, 0.0, dd) * uDrop.z;

    gl_FragColor = vec4(next, h, 0.0, 1.0);
  }
`;

const displayFragment = /* glsl */ `
  uniform sampler2D uState;
  uniform sampler2D uPool;
  uniform vec2  uTexel;
  uniform float uTime;
  uniform float uDepth;      // controlado por el scroll
  varying vec2 vUv;

  void main() {
    float hL = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
    float hR = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
    float hD = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
    float hU = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;
    vec3 normal = normalize(vec3(hL - hR, hD - hU, 0.12));

    // Refracción: el fondo se desplaza según la inclinación del agua
    vec2 refr = vUv + normal.xy * 0.06;
    vec3 floorCol = texture2D(uPool, refr).rgb;

    // Profundidad: más scroll = agua más oscura y azul
    vec3 deep = vec3(0.0, 0.12, 0.2);
    floorCol = mix(floorCol, deep, uDepth * 0.6);

    // Reflejo especular de una luz fija
    vec3 light = normalize(vec3(-0.4, 0.6, 1.0));
    float spec = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);

    // Cáusticas suaves: donde el agua se curva, la luz se concentra
    float caustic = clamp((hL + hR + hD + hU) * 1.8, 0.0, 1.0);

    vec3 col = floorCol + spec * 0.9 + vec3(0.6, 0.95, 1.0) * caustic * 0.25;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Fondo de piscina: degradado turquesa con azulejos, generado con canvas
function makePoolTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 1024, 1024);
  g.addColorStop(0, "#0f7c8c");
  g.addColorStop(1, "#5fd3e6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 3;
  for (let i = 0; i <= 1024; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 150px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MAREA", 512, 560);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function WaterRipples() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      const { renderer } = stage;

      // Dos texturas de simulación que se van alternando (ping-pong)
      const rtOpts = {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      };
      let rtA = new THREE.WebGLRenderTarget(SIM, SIM, rtOpts);
      let rtB = new THREE.WebGLRenderTarget(SIM, SIM, rtOpts);

      const texel = new THREE.Vector2(1 / SIM, 1 / SIM);
      const simUniforms = {
        uState: { value: rtA.texture },
        uTexel: { value: texel },
        uMouse: { value: new THREE.Vector2(-1, -1) },
        uMouseForce: { value: 0 },
        uDrop: { value: new THREE.Vector3(0, 0, 0) },
        uAspect: { value: 1 },
      };
      const simScene = new THREE.Scene();
      const simQuad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ uniforms: simUniforms, vertexShader: simVertex, fragmentShader: simFragment })
      );
      simScene.add(simQuad);

      const pool = makePoolTexture();
      const displayUniforms = {
        uState: { value: rtB.texture },
        uPool: { value: pool },
        uTexel: { value: texel },
        uTime: { value: 0 },
        uDepth: { value: 0 },
      };
      stage.scene.add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({ uniforms: displayUniforms, vertexShader: simVertex, fragmentShader: displayFragment })
        )
      );

      // Mouse: la fuerza depende de la velocidad del movimiento
      let lastX = 0;
      let lastY = 0;
      const onMove = (e) => {
        const r = canvasBox.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = 1 - (e.clientY - r.top) / r.height;
        const speed = Math.hypot(x - lastX, y - lastY);
        lastX = x;
        lastY = y;
        simUniforms.uMouse.value.set(x, y);
        simUniforms.uMouseForce.value = Math.min(speed * 12, 0.5);
      };
      canvasBox.current.addEventListener("pointermove", onMove);

      const reduced = prefersReducedMotion();
      let nextDrop = 0;

      stage.add({
        onResize: (w, h) => (simUniforms.uAspect.value = w / h),
        onFrame: (t) => {
          displayUniforms.uTime.value = t;

          // Gotas automáticas cada ~0.7 s
          if (!reduced && t > nextDrop) {
            simUniforms.uDrop.value.set(Math.random(), Math.random(), 0.35 + Math.random() * 0.3);
            nextDrop = t + 0.5 + Math.random() * 0.6;
          }

          // Dos pasos de simulación por frame: las ondas avanzan más rápido
          for (let i = 0; i < 2; i++) {
            simUniforms.uState.value = rtA.texture;
            renderer.setRenderTarget(rtB);
            renderer.render(simScene, camera);
            [rtA, rtB] = [rtB, rtA];
            simUniforms.uDrop.value.z = 0;
          }
          renderer.setRenderTarget(null);
          simUniforms.uMouseForce.value *= 0.8; // si el mouse se detiene, deja de empujar
          displayUniforms.uState.value = rtA.texture;
        },
      });

      gsap.to(displayUniforms.uDepth, {
        value: 1,
        ease: "none",
        scrollTrigger: { trigger: wrap.current, start: "top top", end: "bottom top", scrub: true },
      });

      gsap.from(".water-copy > *", {
        y: 40,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: wrap.current, start: "top 60%" },
      });

      return () => {
        canvasBox.current?.removeEventListener("pointermove", onMove);
        rtA.dispose();
        rtB.dispose();
        pool.dispose();
        simQuad.geometry.dispose();
        simQuad.material.dispose();
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="water-section">
      <div ref={canvasBox} className="canvas-fill" data-cursor />
      <div className="water-copy">
        <p className="eyebrow">Marea · 01 · Agua simulada en la GPU</p>
        <h2>Pasa el mouse sobre el agua</h2>
      </div>
    </section>
  );
}
