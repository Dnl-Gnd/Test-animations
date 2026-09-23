"use client";

import { useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";

gsap.registerPlugin(ScrollTrigger);

/**
 * ÁMBAR A — Gota de resina 3D con refracción.
 * Es una esfera con MeshPhysicalMaterial en modo transmisión (vidrio/resina):
 * deja ver lo que hay detrás, desviado (ior), con dispersión de colores.
 * Se deforma en el vertex shader: con onBeforeCompile se inyecta ruido en el
 * shader de Three.js y se recalculan las normales moviendo dos puntos vecinos,
 * así la luz y los reflejos siguen la forma nueva.
 * - Detrás hay un texto gigante y partículas doradas: la gota los refracta.
 * - El mouse gira la gota y aumenta la deformación según la velocidad.
 * - El scroll cambia el tamaño, la frecuencia del ruido y el color.
 */
const DEFORM = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform float uFrequency;
  ${simplexNoise3D}

  vec3 deform(vec3 p) {
    float n = snoise(p * uFrequency + vec3(0.0, uTime * 0.35, 0.0));
    n += 0.5 * snoise(p * uFrequency * 2.1 - vec3(uTime * 0.2));
    return p + normalize(p) * n * uStrength;
  }
`;

function makeBackdrop() {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#12071f";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#ff8a1f";
  ctx.font = "800 420px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ÁMBAR", 1024, 540);
  ctx.strokeStyle = "rgba(255,190,120,0.35)";
  ctx.lineWidth = 4;
  for (let y = 60; y < 1024; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(2048, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function ResinBlob() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 7);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      const { renderer, scene } = stage;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setClearColor("#12071f");

      // Entorno para los reflejos (una habitación virtual con luces)
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      // Fondo: texto gigante que la gota va a refractar
      const backdropTex = makeBackdrop();
      const backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 8),
        new THREE.MeshBasicMaterial({ map: backdropTex, toneMapped: false })
      );
      backdrop.position.z = -3;
      scene.add(backdrop);

      // Polvo dorado flotando entre el fondo y la gota
      const dustCount = 400;
      const dustPos = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        dustPos.set([(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 7, -2.5 + Math.random() * 3], i * 3);
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
      const dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({ color: "#ffc27a", size: 0.035, transparent: true, opacity: 0.8, depthWrite: false })
      );
      scene.add(dust);

      // Material de resina + deformación inyectada
      const custom = {
        uTime: { value: 0 },
        uStrength: { value: 0.18 },
        uFrequency: { value: 0.9 },
      };
      const material = new THREE.MeshPhysicalMaterial({
        color: "#ffd9a0",
        roughness: 0.05,
        metalness: 0,
        transmission: 1,
        thickness: 1.2,
        ior: 1.45,
        dispersion: 1.5,
        attenuationColor: new THREE.Color("#ffab4a"),
        attenuationDistance: 3.5,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.2,
      });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, custom);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${DEFORM}`)
          .replace(
            "#include <beginnormal_vertex>",
            `
            // Normal nueva: se deforman dos puntos vecinos y se hace el producto cruz
            vec3 p0 = deform(position);
            vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
            vec3 bitangent = normalize(cross(normal, tangent));
            float eps = 0.01;
            vec3 p1 = deform(position + tangent * eps);
            vec3 p2 = deform(position + bitangent * eps);
            vec3 objectNormal = normalize(cross(p1 - p0, p2 - p0));
            #ifdef USE_TANGENT
              vec3 objectTangent = vec3(tangent);
            #endif
            `
          )
          .replace("#include <begin_vertex>", "vec3 transformed = p0;");
      };

      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 48), material);
      scene.add(blob);

      // Mouse: giro suave y "golpe" de deformación según la velocidad
      const rot = { x: 0, y: 0 };
      const toRX = gsap.quickTo(rot, "x", { duration: 1.2, ease: "power3.out" });
      const toRY = gsap.quickTo(rot, "y", { duration: 1.2, ease: "power3.out" });
      let lx = 0;
      let ly = 0;
      const extra = { v: 0 };
      const onMove = (e) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        toRY(nx * 0.8);
        toRX(ny * 0.5);
        const speed = Math.hypot(nx - lx, ny - ly);
        lx = nx;
        ly = ny;
        gsap.to(extra, { v: Math.min(speed * 2, 0.15), duration: 0.3, overwrite: true });
        gsap.to(extra, { v: 0, duration: 1.4, delay: 0.3, ease: "power2.out" });
      };
      window.addEventListener("pointermove", onMove);

      const scroll = { strength: 0.18 };
      const reduced = prefersReducedMotion();
      stage.add({
        onFrame: (t) => {
          custom.uTime.value = reduced ? 0 : t;
          custom.uStrength.value = scroll.strength + extra.v;
          blob.rotation.x = rot.x + t * 0.05;
          blob.rotation.y = rot.y + t * 0.1;
          dust.rotation.z = t * 0.01;
          dust.position.y = Math.sin(t * 0.3) * 0.1;
        },
      });

      // Scroll: la gota crece, se vuelve más orgánica y cambia de color
      gsap
        .timeline({ scrollTrigger: { trigger: wrap.current, start: "top bottom", end: "bottom top", scrub: 1 } })
        .fromTo(blob.scale, { x: 0.8, y: 0.8, z: 0.8 }, { x: 1.15, y: 1.15, z: 1.15, ease: "none" }, 0)
        .fromTo(scroll, { strength: 0.12 }, { strength: 0.26, ease: "none" }, 0)
        .fromTo(custom.uFrequency, { value: 0.55 }, { value: 0.95, ease: "none" }, 0)
        .to(material.attenuationColor, { r: 1, g: 0.45, b: 0.12, ease: "none" }, 0);

      gsap.from(".resin-copy > *", {
        y: 40,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: wrap.current, start: "top 60%" },
      });

      return () => {
        window.removeEventListener("pointermove", onMove);
        envTex.dispose();
        pmrem.dispose();
        backdropTex.dispose();
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="resin-section">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="resin-copy">
        <p className="eyebrow">Ámbar · 01 · Resina 3D con refracción</p>
        <h2>Una gota que dobla la luz</h2>
        <p>Mueve el mouse rápido para agitarla. Detrás hay texto real: lo que ves deformado es la refracción.</p>
      </div>
    </section>
  );
}
