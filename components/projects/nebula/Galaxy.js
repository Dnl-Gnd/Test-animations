"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";

gsap.registerPlugin(ScrollTrigger);

const COUNT = 60000;
const RADIUS = 6;
const BRANCHES = 4;
const SPIN = 1.1;

/**
 * NÉBULA A — Galaxia espiral de partículas con viaje de cámara por scroll.
 * Las posiciones salen de una fórmula:
 *   - radio aleatorio (más partículas cerca del centro)
 *   - ángulo = brazo (0..BRANCHES) + giro proporcional al radio -> espiral
 *   - dispersión aleatoria que crece hacia afuera
 * El vertex shader hace la rotación diferencial: el centro gira más rápido que
 * los bordes (por eso los brazos se "enrollan" con el tiempo).
 * ScrollTrigger fija la sección y mueve la cámara desde arriba hasta el núcleo.
 */
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute float aScale;
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);

    // Rotación diferencial: velocidad angular = 1 / distancia al centro
    float angle = atan(world.x, world.z);
    float dist = length(world.xz);
    angle += (1.0 / (dist + 0.4)) * uTime * 0.25;
    world.x = sin(angle) * dist;
    world.z = cos(angle) * dist;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(uSize * (0.3 + aScale * 0.7) * (1.0 / -mv.z), 28.0);
    vColor = aColor;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  void main() {
    // Punto con brillo concentrado en el centro
    float d = length(gl_PointCoord - 0.5);
    float strength = pow(1.0 - clamp(d * 2.0, 0.0, 1.0), 3.0);
    gl_FragColor = vec4(vColor * strength * 0.55, 1.0);
  }
`;

function buildGalaxy() {
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const scales = new Float32Array(COUNT);
  const inside = new THREE.Color("#ff9a6b");
  const outside = new THREE.Color("#3b5bff");
  const tmp = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    const r = Math.pow(Math.random(), 1.6) * RADIUS;
    const branch = ((i % BRANCHES) / BRANCHES) * Math.PI * 2;
    const spin = r * SPIN;

    // Dispersión: potencia alta = la mayoría cerca del brazo, pocas lejos
    const scatter = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.45 * (r + 0.3);
    positions[i * 3] = Math.cos(branch + spin) * r + scatter();
    positions[i * 3 + 1] = scatter() * 0.35;
    positions[i * 3 + 2] = Math.sin(branch + spin) * r + scatter();

    tmp.copy(inside).lerp(outside, r / RADIUS);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    scales[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  return geo;
}

export default function Galaxy() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 9, 9);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      stage.renderer.setClearColor("#03030a");

      const uniforms = {
        uTime: { value: 0 },
        uSize: { value: 220 * stage.renderer.getPixelRatio() },
      };
      const galaxy = new THREE.Points(
        buildGalaxy(),
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader,
          fragmentShader,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      stage.scene.add(galaxy);

      // Recorrido de la cámara: posición y punto al que mira
      const cam = { x: 0, y: 9, z: 9, lookY: 0 };
      const mouse = { x: 0, y: 0 };
      const toX = gsap.quickTo(mouse, "x", { duration: 1.5, ease: "power3.out" });
      const toY = gsap.quickTo(mouse, "y", { duration: 1.5, ease: "power3.out" });
      const onMove = (e) => {
        toX((e.clientX / window.innerWidth) * 2 - 1);
        toY((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove);

      const reduced = prefersReducedMotion();
      const look = new THREE.Vector3();
      stage.add({
        onFrame: (t) => {
          uniforms.uTime.value = reduced ? 0 : t;
          camera.position.set(cam.x + mouse.x * 0.8, cam.y - mouse.y * 0.5, cam.z);
          look.set(0, cam.lookY, 0);
          camera.lookAt(look);
        },
      });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: wrap.current, start: "top top", end: "+=250%", scrub: 1.2, pin: true },
      });
      tl.to(cam, { y: 3, z: 7, x: 3, duration: 1, ease: "power1.inOut" })
        .to(cam, { y: 1.1, z: 3.4, x: 0.6, lookY: 0.1, duration: 1, ease: "power2.inOut" })
        .to(".galaxy-step-1", { autoAlpha: 0, y: -30, duration: 0.2 }, 0.35)
        .fromTo(".galaxy-step-2", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.5)
        .to(".galaxy-step-2", { autoAlpha: 0, y: -30, duration: 0.2 }, 1.3)
        .fromTo(".galaxy-step-3", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 1.5);

      return () => {
        window.removeEventListener("pointermove", onMove);
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="galaxy">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="galaxy-copy">
        <p className="eyebrow">Nébula · 01 · Galaxia de partículas</p>
        <div className="galaxy-steps">
          <h2 className="galaxy-step galaxy-step-1">60 000 estrellas calculadas con una fórmula.</h2>
          <h2 className="galaxy-step galaxy-step-2">El centro gira más rápido que los bordes.</h2>
          <h2 className="galaxy-step galaxy-step-3">Y el scroll te lleva hasta el núcleo.</h2>
        </div>
      </div>
    </section>
  );
}
