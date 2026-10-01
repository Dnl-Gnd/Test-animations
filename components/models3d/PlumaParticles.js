"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";

gsap.registerPlugin(ScrollTrigger);

const IMAGE = "/3d/pluma.png"; // fotograma de Pluma.webm, en gris sobre negro
const STEP = 2; // se toma 1 de cada 2 píxeles de la imagen (512 px → ~30 000 partículas)
const SIZE = 4.1; // ancho de la pluma en unidades del mundo
const DEPTH = 0.9; // relieve: los píxeles claros quedan más cerca de la cámara

// Física del hover (por frame a 60 fps)
const RADIUS = 0.55; // radio del "hueco" alrededor del cursor
const FORCE = 0.035; // empuje hacia afuera
const SPRING = 0.045; // fuerza que devuelve cada partícula a su lugar
const DAMPING = 0.88; // < 1: el rebote se apaga poco a poco

/**
 * PLUMA — Imagen convertida en partículas que reaccionan al cursor.
 * 1. Se lee la imagen en un <canvas> y cada píxel claro se vuelve una partícula.
 *    El brillo da la profundidad (z), así la pluma conserva su volumen.
 * 2. Cada partícula tiene un desplazamiento y una velocidad (calculados en JS):
 *    el cursor la empuja y un resorte la regresa, por eso el hueco "rebota".
 * 3. Con el scroll (sección fijada) todas se esponjan, viajan a una esfera de
 *    pelusa y vuelven a formar la pluma, como en el video.
 */
const vertexShader = /* glsl */ `
  uniform float uPixelRatio;
  attribute float aLum;
  attribute float aRandom;
  attribute float aGlow;
  varying float vLum;
  varying float vGlow;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.2 + aRandom * 2.2 + aGlow * 1.5) * uPixelRatio * (7.0 / -mv.z);
    vLum = aLum;
    vGlow = aGlow;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vLum;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.05, d);
    // Blanco frío en las luces, azul en las sombras; las partículas empujadas brillan en azul
    vec3 color = mix(vec3(0.25, 0.4, 1.0), vec3(0.95, 0.97, 1.0), vLum) * (0.5 + vLum * 0.9);
    color += vec3(0.3, 0.55, 1.0) * vGlow;
    gl_FragColor = vec4(color, alpha * (0.75 + vGlow * 0.25));
  }
`;

/** Lee la imagen y devuelve las posiciones de la pluma y de la bola de pelusa */
async function sampleImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  const base = [];
  const lum = [];
  for (let y = 0; y < h; y += STEP) {
    for (let x = 0; x < w; x += STEP) {
      const l = data[(y * w + x) * 4] / 255; // la imagen es gris: basta el canal rojo
      if (l < 0.18) continue; // fondo negro
      // Un poco de azar dentro de la celda para que no se note la cuadrícula
      const px = x + Math.random() * STEP;
      const py = y + Math.random() * STEP;
      base.push(
        (px / w - 0.5) * SIZE,
        -(py / h - 0.5) * SIZE * (h / w),
        (l - 0.6) * DEPTH + (Math.random() - 0.5) * 0.06
      );
      lum.push(l);
    }
  }

  const count = lum.length;
  const sphere = new Float32Array(count * 3);
  const fuzz = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // Bola de pelusa: denso en el centro, con fibras sueltas hacia afuera
    v.randomDirection().multiplyScalar(1.35 * Math.pow(Math.random(), 0.45));
    sphere.set([v.x, v.y, v.z], i * 3);
    // Dirección en la que cada partícula se "esponja" a mitad del cambio
    v.randomDirection().multiplyScalar(0.12 + Math.random() * 0.28);
    fuzz.set([v.x, v.y, v.z], i * 3);
  }

  return { count, base: new Float32Array(base), lum: new Float32Array(lum), sphere, fuzz };
}

export default function PlumaParticles() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      let cancelled = false;
      let cleanup = () => {};

      // Sección fijada: el scroll lleva la pluma a la esfera y de regreso.
      // Se crea antes de cargar la imagen para que el pin exista desde el inicio.
      const morph = { value: 0 };
      gsap
        .timeline({
          scrollTrigger: { trigger: wrap.current, start: "top top", end: "+=250%", scrub: 1, pin: true },
        })
        .to(morph, { value: 1, duration: 1, ease: "power2.inOut" }, 0)
        .to(".pluma-step-1", { autoAlpha: 0, y: -30, duration: 0.2 }, 0.15)
        .fromTo(".pluma-step-2", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.4)
        .to(morph, { value: 0, duration: 1, ease: "power2.inOut" }, 1.3)
        .to(".pluma-step-2", { autoAlpha: 0, y: -30, duration: 0.2 }, 1.45)
        .fromTo(".pluma-step-3", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 1.7)
        .to({}, { duration: 0.2 }); // pausa al final con la pluma completa

      sampleImage(IMAGE).then(({ count, base, lum, sphere, fuzz }) => {
        if (cancelled) return;

        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0, 8);
        const stage = createStage(canvasBox.current, { camera });

        const position = new Float32Array(base);
        const offset = new Float32Array(count * 3); // desplazamiento por el cursor
        const velocity = new Float32Array(count * 3);
        const glow = new Float32Array(count);
        const random = new Float32Array(count).map(() => Math.random());

        const geo = new THREE.BufferGeometry();
        const posAttr = new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage);
        const glowAttr = new THREE.BufferAttribute(glow, 1).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("position", posAttr);
        geo.setAttribute("aGlow", glowAttr);
        geo.setAttribute("aLum", new THREE.BufferAttribute(lum, 1));
        geo.setAttribute("aRandom", new THREE.BufferAttribute(random, 1));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

        const points = new THREE.Points(
          geo,
          new THREE.ShaderMaterial({
            uniforms: { uPixelRatio: { value: stage.renderer.getPixelRatio() } },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        stage.scene.add(points);

        // Pantallas anchas: la pluma va a la derecha para no tapar el texto.
        // Pantallas angostas: la cámara se aleja para que quepa.
        stage.add({
          onResize: (w, h) => {
            camera.position.z = w / h < 0.9 ? 8 / (w / h / 0.9) : 8;
            points.position.x = w / h > 1.2 ? 1.5 : 0;
          },
        });

        // Mouse → plano z = 0 de la pluma (en coordenadas locales, para que siga
        // funcionando aunque la pluma esté inclinada)
        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const ndc = new THREE.Vector2();
        const hit = new THREE.Vector3();
        const mouse = new THREE.Vector2(99, 99);
        const tilt = { x: 0, y: 0 };
        const tiltX = gsap.quickTo(tilt, "x", { duration: 1.2, ease: "power3.out" });
        const tiltY = gsap.quickTo(tilt, "y", { duration: 1.2, ease: "power3.out" });

        const onMove = (e) => {
          const rect = canvasBox.current.getBoundingClientRect();
          ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
          tiltX(ndc.y * -0.18);
          tiltY(ndc.x * 0.3);
          raycaster.setFromCamera(ndc, camera);
          if (raycaster.ray.intersectPlane(plane, hit)) {
            points.worldToLocal(hit);
            mouse.set(hit.x, hit.y);
          }
        };
        const onLeave = () => {
          mouse.set(99, 99);
          tiltX(0);
          tiltY(0);
        };
        const section = wrap.current;
        section.addEventListener("pointermove", onMove);
        section.addEventListener("pointerleave", onLeave);


        const reduced = prefersReducedMotion();
        const R2 = RADIUS * RADIUS;
        let last = 0;

        stage.add({
          onFrame: (t) => {
            const dt = Math.min((t - last) * 60, 3); // 1 = un frame a 60 fps
            last = t;
            points.rotation.x = tilt.x;
            points.rotation.y = tilt.y + (reduced ? 0 : Math.sin(t * 0.4) * 0.08);

            const m = morph.value;
            const spring = SPRING * dt;
            const damping = Math.pow(DAMPING, dt);

            for (let i = 0; i < count; i++) {
              const i3 = i * 3;
              // Mezcla pluma/bola, desfasada por partícula para que no viajen todas juntas
              const r = random[i];
              let k = (m - r * 0.35) / 0.65;
              k = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
              // Pelusa: máxima a mitad del viaje (k = 0.5), nula en la pluma y en la esfera
              const p = k * (1 - k) * 4;
              const rx = base[i3] + (sphere[i3] - base[i3]) * k + fuzz[i3] * p;
              const ry = base[i3 + 1] + (sphere[i3 + 1] - base[i3 + 1]) * k + fuzz[i3 + 1] * p;
              const rz = base[i3 + 2] + (sphere[i3 + 2] - base[i3 + 2]) * k + fuzz[i3 + 2] * p;

              let ox = offset[i3];
              let oy = offset[i3 + 1];
              let oz = offset[i3 + 2];
              let vx = velocity[i3];
              let vy = velocity[i3 + 1];
              let vz = velocity[i3 + 2];

              // Empuje del cursor: más fuerte en el centro del radio
              const dx = rx + ox - mouse.x;
              const dy = ry + oy - mouse.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < R2) {
                const d = Math.sqrt(d2) + 1e-4;
                const f = (1 - d / RADIUS) ** 2 * FORCE * dt;
                vx += (dx / d) * f;
                vy += (dy / d) * f;
                vz -= f * 0.8; // se hunden un poco, como una abolladura
              }

              // Resorte hacia su lugar + amortiguación
              vx = (vx - ox * spring) * damping;
              vy = (vy - oy * spring) * damping;
              vz = (vz - oz * spring) * damping;
              ox += vx * dt;
              oy += vy * dt;
              oz += vz * dt;

              offset[i3] = ox;
              offset[i3 + 1] = oy;
              offset[i3 + 2] = oz;
              velocity[i3] = vx;
              velocity[i3 + 1] = vy;
              velocity[i3 + 2] = vz;
              position[i3] = rx + ox;
              position[i3 + 1] = ry + oy;
              position[i3 + 2] = rz + oz;
              glow[i] = Math.min(1, Math.sqrt(ox * ox + oy * oy) * 4);
            }
            posAttr.needsUpdate = true;
            glowAttr.needsUpdate = true;
          },
        });

        gsap.from(points.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 1.6, ease: "expo.out", delay: 0.6 });

        cleanup = () => {
          section.removeEventListener("pointermove", onMove);
          section.removeEventListener("pointerleave", onLeave);
          stage.destroy();
        };
      });

      return () => {
        cancelled = true;
        cleanup();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="pluma-section">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="pluma-copy">
        <p className="eyebrow">Hover + scroll · Partículas</p>
        <div className="pluma-steps">
          <h2 className="pluma-step pluma-step-1">Pasa el cursor sobre la pluma y haz scroll ↓</h2>
          <h2 className="pluma-step pluma-step-2">Se deshace en una esfera de pelusa…</h2>
          <h2 className="pluma-step pluma-step-3">…y vuelve a su forma original.</h2>
        </div>
      </div>
    </section>
  );
}
