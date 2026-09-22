"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";

gsap.registerPlugin(ScrollTrigger);

const COUNT = 18000;

/**
 * DEMO 2 — Partículas que cambian de forma con el scroll.
 * Cada partícula guarda DOS posiciones calculadas con fórmulas:
 *   aSphere: un punto sobre una esfera (distribución de Fibonacci)
 *   aHelix:  un punto sobre una doble hélice (ecuación paramétrica)
 * El vertex shader mezcla ambas con uMorph (0..1), que controla ScrollTrigger
 * mientras la sección está fijada (pin). Encima se suma ruido para que "respire"
 * y el mouse empuja las partículas cercanas.
 */
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMorph;
  uniform vec3  uMouse;       // posición del mouse en el mundo (plano z = 0)
  uniform float uPixelRatio;
  attribute vec3 aSphere;
  attribute vec3 aHelix;
  attribute float aRandom;
  varying float vMix;
  varying float vRandom;

  ${simplexNoise3D}

  void main() {
    // Curva de transición desfasada por partícula: no cambian todas a la vez
    float m = smoothstep(aRandom * 0.4, 0.6 + aRandom * 0.4, uMorph);
    vec3 pos = mix(aSphere, aHelix, m);

    // "Respiración" con ruido
    float n = snoise(pos * 0.6 + uTime * 0.25);
    pos += normalize(pos + 0.0001) * n * 0.18;

    vec4 world = modelMatrix * vec4(pos, 1.0);

    // Repulsión del mouse
    vec3 dir = world.xyz - uMouse;
    float dist = length(dir.xy);
    world.xyz += normalize(dir) * smoothstep(1.4, 0.0, dist) * 0.7;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + aRandom * 3.0) * uPixelRatio * (6.0 / -mv.z);

    vMix = m;
    vRandom = aRandom;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vMix;
  varying float vRandom;
  void main() {
    // Punto circular con borde suave
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d);
    vec3 a = vec3(0.55, 0.45, 1.0);
    vec3 b = vec3(1.0, 0.55, 0.35);
    vec3 color = mix(a, b, vMix) * (0.7 + vRandom * 0.6);
    gl_FragColor = vec4(color, alpha * 0.85);
  }
`;

function buildGeometry() {
  const sphere = new Float32Array(COUNT * 3);
  const helix = new Float32Array(COUNT * 3);
  const random = new Float32Array(COUNT);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < COUNT; i++) {
    // Esfera de Fibonacci: puntos repartidos de forma uniforme
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const R = 2.2;
    sphere.set([Math.cos(theta) * r * R, y * R, Math.sin(theta) * r * R], i * 3);

    // Doble hélice: x = cos(t), z = sin(t), y avanza con t
    const t = (i / COUNT) * Math.PI * 10;
    const strand = i % 2 === 0 ? 0 : Math.PI; // dos hebras opuestas
    const spread = (Math.random() - 0.5) * 0.35;
    const hr = 1.3 + spread;
    helix.set(
      [Math.cos(t + strand) * hr, (i / COUNT - 0.5) * 7.0, Math.sin(t + strand) * hr],
      i * 3
    );

    random[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(sphere.slice(), 3));
  geo.setAttribute("aSphere", new THREE.BufferAttribute(sphere, 3));
  geo.setAttribute("aHelix", new THREE.BufferAttribute(helix, 3));
  geo.setAttribute("aRandom", new THREE.BufferAttribute(random, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
  return geo;
}

export default function ParticleMorph() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 8);
      const stage = createStage(canvasBox.current, { camera });

      const uniforms = {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uMouse: { value: new THREE.Vector3(99, 99, 0) },
        uPixelRatio: { value: stage.renderer.getPixelRatio() },
      };
      const points = new THREE.Points(
        buildGeometry(),
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      // Desplazada a la derecha en pantallas anchas para no tapar el texto
      points.position.x = window.innerWidth > 900 ? 1.8 : 0;
      stage.scene.add(points);

      const reduced = prefersReducedMotion();
      stage.add({
        onFrame: (t) => {
          uniforms.uTime.value = reduced ? 0 : t;
          points.rotation.y = t * 0.12 + uniforms.uMorph.value * Math.PI;
        },
      });

      // Mouse -> punto en el plano z = 0 con un Raycaster
      const raycaster = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const ndc = new THREE.Vector2();
      const target = new THREE.Vector3(99, 99, 0);
      const toX = gsap.quickTo(uniforms.uMouse.value, "x", { duration: 0.6, ease: "power3.out" });
      const toY = gsap.quickTo(uniforms.uMouse.value, "y", { duration: 0.6, ease: "power3.out" });
      const onMove = (e) => {
        const rect = canvasBox.current.getBoundingClientRect();
        ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(plane, target)) {
          toX(target.x);
          toY(target.y);
        }
      };
      window.addEventListener("pointermove", onMove);

      // Sección fijada: el scroll avanza la transformación y los textos
      const tl = gsap.timeline({
        scrollTrigger: { trigger: wrap.current, start: "top top", end: "+=200%", scrub: 1, pin: true },
      });
      tl.to(uniforms.uMorph, { value: 1, ease: "none", duration: 1 }, 0)
        .to(camera.position, { z: 9.5, ease: "none", duration: 1 }, 0)
        .to(".pm-step-1", { autoAlpha: 0, y: -30, duration: 0.2 }, 0.3)
        .fromTo(".pm-step-2", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.55);

      return () => {
        window.removeEventListener("pointermove", onMove);
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="pinned">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="pinned-content">
        <p className="eyebrow">Demo 02 · Partículas + scroll</p>
        <h2 className="pm-step pm-step-1">18 000 puntos sobre una esfera…</h2>
        <h2 className="pm-step pm-step-2">…que se reordenan en una doble hélice.</h2>
      </div>
    </section>
  );
}
