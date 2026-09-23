"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { setCursor } from "@/components/Cursor";

gsap.registerPlugin(ScrollTrigger);

const CARDS = [
  { title: "Aurora", a: "#6d4bff", b: "#ff7a59" },
  { title: "Nébula", a: "#1b3cff", b: "#7cffd4" },
  { title: "Coral", a: "#ff4f7b", b: "#ffd36b" },
  { title: "Marea", a: "#0f7c8c", b: "#b6f0ff" },
  { title: "Ámbar", a: "#ff8a1f", b: "#3a0f5c" },
  { title: "Glaciar", a: "#c9d8ff", b: "#3056ff" },
  { title: "Brasa", a: "#ff3d2e", b: "#1a0b2e" },
];
const W = 3.2;
const H = 4.2;
const GAP = 0.7;

/**
 * DEMO 04 — Galería de imágenes que se curvan con el scroll.
 * Cada imagen es un plano de Three.js (no un <img>), así el vertex shader puede
 * deformarla:
 *   - Curva de cilindro: las tarjetas se van hacia atrás en los bordes.
 *   - Flexión por velocidad: al hacer scroll rápido se arquean como tela.
 * El fragment shader recorta las esquinas redondeadas, separa los canales RGB
 * según la velocidad y pasa de gris a color al hacer hover.
 * Las "imágenes" se generan con <canvas> para no depender de archivos.
 */
const vertexShader = /* glsl */ `
  uniform float uVelocity;   // -1..1
  uniform float uCurve;
  uniform float uHover;      // 0..1
  varying vec2 vUv;
  #define PI 3.14159265

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);

    // 1. Curva de cilindro según la posición en pantalla
    world.z -= world.x * world.x * uCurve;

    // 2. Flexión por velocidad: el centro de la tarjeta se queda atrás
    world.x -= sin(uv.y * PI) * uVelocity * 0.6;

    // 3. Hover: la tarjeta se abomba un poco hacia la cámara
    world.z += sin(uv.x * PI) * sin(uv.y * PI) * uHover * 0.35;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uVelocity;
  uniform float uHover;
  uniform vec2  uSize;
  varying vec2 vUv;

  // Distancia a un rectángulo con esquinas redondeadas (SDF)
  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRoundBox(p, uSize * 0.5, 0.22);
    float alpha = 1.0 - smoothstep(-0.01, 0.01, d);

    // Zoom interno en hover
    vec2 uv = (vUv - 0.5) * (1.0 - uHover * 0.1) + 0.5;

    // Separación RGB según la velocidad
    float shift = uVelocity * 0.025;
    vec3 color = vec3(
      texture2D(uTexture, uv + vec2(shift, 0.0)).r,
      texture2D(uTexture, uv).g,
      texture2D(uTexture, uv - vec2(shift, 0.0)).b
    );

    // De gris a color con hover
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray) * 0.85, color, 0.35 + uHover * 0.65);

    gl_FragColor = vec4(color, alpha);
  }
`;

// Genera una "imagen" con canvas: degradado, círculos y título
function makeTexture({ title, a, b }, index) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 840;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(
      c.width * (0.2 + ((i * 37 + index * 13) % 60) / 100),
      c.height * (0.15 + ((i * 53 + index * 7) % 70) / 100),
      80 + ((i * 29) % 160),
      0,
      Math.PI * 2
    );
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 64px system-ui, sans-serif";
  ctx.fillText(title, 48, c.height - 64);
  ctx.font = "500 28px ui-monospace, monospace";
  ctx.fillText(String(index + 1).padStart(2, "0"), 48, 76);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export default function CurvedGallery() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);
  const counter = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 11);
      const stage = createStage(canvasBox.current, { camera });

      const shared = {
        uVelocity: { value: 0 },
        uCurve: { value: 0.035 },
      };

      const group = new THREE.Group();
      stage.scene.add(group);
      const track = new THREE.Group();
      group.add(track);

      const geometry = new THREE.PlaneGeometry(W, H, 32, 32);
      const meshes = CARDS.map((card, i) => {
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          transparent: true,
          uniforms: {
            ...shared,
            uTexture: { value: makeTexture(card, i) },
            uHover: { value: 0 },
            uSize: { value: new THREE.Vector2(W, H) },
          },
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = i * (W + GAP);
        track.add(mesh);
        return mesh;
      });

      const travel = (CARDS.length - 1) * (W + GAP);
      const state = { progress: 0 };
      let lastX = 0;
      const reduced = prefersReducedMotion();

      stage.add({
        onFrame: () => {
          track.position.x = -state.progress * travel;
          // Velocidad = cuánto se movió el track en este frame (suavizado)
          const delta = track.position.x - lastX;
          lastX = track.position.x;
          const target = reduced ? 0 : THREE.MathUtils.clamp(delta * 6, -1, 1);
          shared.uVelocity.value += (target - shared.uVelocity.value) * 0.12;
        },
        onResize: (w, h) => group.scale.setScalar(Math.min(1, (w / h) / 1.3)),
      });

      // Hover con Raycaster
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      let hovered = null;
      const onMove = (e) => {
        const rect = canvasBox.current.getBoundingClientRect();
        ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects(meshes)[0]?.object ?? null;
        if (hit === hovered) return;
        if (hovered) gsap.to(hovered.material.uniforms.uHover, { value: 0, duration: 0.6, ease: "power3.out" });
        if (hit) gsap.to(hit.material.uniforms.uHover, { value: 1, duration: 0.6, ease: "power3.out" });
        hovered = hit;
        setCursor(hit ? "Ver" : null);
      };
      const onLeave = () => {
        if (hovered) gsap.to(hovered.material.uniforms.uHover, { value: 0, duration: 0.6 });
        hovered = null;
        setCursor(null);
      };
      canvasBox.current.addEventListener("pointermove", onMove);
      canvasBox.current.addEventListener("pointerleave", onLeave);

      // Sección fijada: el scroll vertical mueve la galería en horizontal
      gsap.to(state, {
        progress: 1,
        ease: "none",
        scrollTrigger: {
          trigger: wrap.current,
          start: "top top",
          end: "+=300%",
          scrub: 1,
          pin: true,
          onUpdate: (self) => {
            const n = Math.round(self.progress * (CARDS.length - 1)) + 1;
            if (counter.current) counter.current.textContent = String(n).padStart(2, "0");
          },
        },
      });

      return () => {
        canvasBox.current?.removeEventListener("pointermove", onMove);
        canvasBox.current?.removeEventListener("pointerleave", onLeave);
        meshes.forEach((m) => m.material.uniforms.uTexture.value.dispose());
        setCursor(null);
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="gallery">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="gallery-content">
        <p className="eyebrow">Demo 04 · Imágenes que se curvan</p>
        <h2>Haz scroll rápido y pasa el mouse por encima</h2>
      </div>
      <p className="gallery-counter">
        <span ref={counter}>01</span> / {String(CARDS.length).padStart(2, "0")}
      </p>
    </section>
  );
}
