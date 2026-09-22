"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";

/**
 * DEMO 3 — Terreno de ondas en wireframe.
 * Un plano plano con 200x200 subdivisiones. El vertex shader sube o baja cada
 * vértice con ruido que avanza en el tiempo (parece que "vuelas" sobre él).
 * El fragment shader aplica niebla según la distancia a la cámara.
 * El mouse inclina la cámara (parallax) y al hacer clic se genera una onda
 * expansiva animada con GSAP.
 */
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uPulseOrigin;
  uniform float uPulse;       // 0..1 progreso de la onda del clic
  varying float vHeight;
  varying float vDepth;

  ${simplexNoise3D}

  void main() {
    vec3 pos = position;
    float t = uTime * 0.35;

    // Dos capas de ruido: colinas grandes + detalle fino
    float h = snoise(vec3(pos.x * 0.25, pos.y * 0.25 + t, 0.0)) * 0.9;
    h += snoise(vec3(pos.x * 0.8, pos.y * 0.8 + t * 1.5, 1.0)) * 0.2;

    // Onda expansiva desde el punto del clic
    float d = distance(pos.xy, uPulseOrigin);
    float ring = uPulse * 14.0;
    h += sin((d - ring) * 3.0) * exp(-abs(d - ring) * 1.5) * (1.0 - uPulse) * 1.2;

    pos.z += h;
    vHeight = h;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorLow;
  uniform vec3 uColorHigh;
  uniform vec3 uFog;
  varying float vHeight;
  varying float vDepth;
  void main() {
    vec3 color = mix(uColorLow, uColorHigh, smoothstep(-0.6, 1.0, vHeight));
    float fog = smoothstep(4.0, 22.0, vDepth);
    gl_FragColor = vec4(mix(color, uFog, fog), 1.0);
  }
`;

export default function WaveTerrain() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 2.2, 6);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      const fogColor = new THREE.Color("#07070c");
      stage.renderer.setClearColor(fogColor);

      const uniforms = {
        uTime: { value: 0 },
        uPulseOrigin: { value: new THREE.Vector2(0, 0) },
        uPulse: { value: 1 },
        uColorLow: { value: new THREE.Color("#1b3cff") },
        uColorHigh: { value: new THREE.Color("#7cffd4") },
        uFog: { value: fogColor },
      };

      const geo = new THREE.PlaneGeometry(30, 30, 200, 200);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, wireframe: true })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.z = -6;
      stage.scene.add(mesh);

      const lookTarget = new THREE.Vector3(0, 0, -6);
      const cam = { x: 0, y: 2.2 };
      const toX = gsap.quickTo(cam, "x", { duration: 1.5, ease: "power3.out" });
      const toY = gsap.quickTo(cam, "y", { duration: 1.5, ease: "power3.out" });

      const reduced = prefersReducedMotion();
      stage.add({
        onFrame: (t) => {
          uniforms.uTime.value = reduced ? 0 : t;
          camera.position.x = cam.x;
          camera.position.y = cam.y;
          camera.lookAt(lookTarget);
        },
      });

      const onMove = (e) => {
        const rect = canvasBox.current.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        toX(nx * 2.5);
        toY(2.2 - ny * 1.2);
      };
      window.addEventListener("pointermove", onMove);

      // Clic -> raycast contra el plano y lanzar una onda con GSAP
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const onClick = (e) => {
        const rect = canvasBox.current.getBoundingClientRect();
        ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObject(mesh)[0];
        if (!hit) return;
        uniforms.uPulseOrigin.value.set(hit.uv.x * 30 - 15, hit.uv.y * 30 - 15);
        gsap.fromTo(uniforms.uPulse, { value: 0 }, { value: 1, duration: 2.5, ease: "power2.out" });
      };
      canvasBox.current.addEventListener("click", onClick);

      return () => {
        window.removeEventListener("pointermove", onMove);
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="terrain">
      <div ref={canvasBox} className="canvas-fill clickable" />
      <div className="terrain-content">
        <p className="eyebrow">Demo 03 · Terreno procedural</p>
        <h2>Haz clic sobre la malla</h2>
      </div>
    </section>
  );
}
