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
const SEGMENTS = 160; // subdivisiones de la malla sólida (161 × 161 vértices)

// Física del hover (por frame a 60 fps)
const RADIUS = 0.9; // radio de la zona que se deforma alrededor del cursor
const FORCE = 0.006; // empuje leve: abolla sin abrir huecos
const SPRING = 0.045; // fuerza que devuelve cada partícula a su lugar
const DAMPING = 0.88; // < 1: el rebote se apaga poco a poco

/**
 * PLUMA — Superficie sólida que se disuelve en partículas.
 * 1. La pluma es una malla subdividida con la imagen como textura; el brillo de
 *    cada píxel sube o baja el vértice (z), así la imagen plana tiene relieve.
 *    Las zonas negras de la imagen se vuelven transparentes.
 * 2. Cada vértice (y cada partícula) tiene desplazamiento y velocidad calculados
 *    en JS: el cursor lo empuja y un resorte lo regresa, por eso la abolladura "rebota".
 * 3. Con el scroll (sección fijada) la superficie se desvanece y en su lugar
 *    quedan partículas que se esponjan, forman una esfera y vuelven a armar la
 *    pluma; al final la superficie sólida reaparece.
 */
const solidVertexShader = /* glsl */ `
  attribute float aGlow;
  varying vec2 vUv;
  varying float vGlow;

  void main() {
    vUv = uv;
    vGlow = aGlow;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const solidFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vGlow;

  void main() {
    float l = texture2D(uMap, vUv).r;
    // El fondo negro de la imagen se recorta
    float alpha = smoothstep(0.12, 0.22, l) * uOpacity;
    if (alpha < 0.01) discard;
    vec3 color = vec3(l) * vec3(0.95, 0.97, 1.03);
    color += vec3(0.3, 0.55, 1.0) * vGlow * 0.35; // brillo azul suave donde se abolla
    gl_FragColor = vec4(color, alpha);
  }
`;

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
  uniform float uOpacity;
  varying float vLum;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.05, d);
    // Blanco frío en las luces, azul en las sombras; las partículas empujadas brillan en azul
    vec3 color = mix(vec3(0.25, 0.4, 1.0), vec3(0.95, 0.97, 1.0), vLum) * (0.5 + vLum * 0.9);
    color += vec3(0.3, 0.55, 1.0) * vGlow;
    gl_FragColor = vec4(color, alpha * (0.75 + vGlow * 0.25) * uOpacity);
  }
`;

/**
 * Lee la imagen y devuelve: las partículas (pluma y bola de pelusa), la malla
 * sólida con relieve y la textura.
 */
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

  // Mapa de profundidad: la misma imagen desenfocada para que el relieve sea suave
  ctx.filter = "blur(8px)";
  ctx.drawImage(img, 0, 0);
  const depthData = ctx.getImageData(0, 0, w, h).data;
  const depthAt = (x, y) => {
    const px = Math.min(w - 1, Math.max(0, Math.round(x)));
    const py = Math.min(h - 1, Math.max(0, Math.round(y)));
    const l = depthData[(py * w + px) * 4] / 255;
    return (Math.max(l, 0.18) - 0.6) * DEPTH;
  };

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
        depthAt(px, py) + (Math.random() - 0.5) * 0.06
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

  // Malla sólida: un plano subdividido cuyos vértices suben según el brillo
  const solid = new THREE.PlaneGeometry(SIZE, SIZE * (h / w), SEGMENTS, SEGMENTS);
  const sp = solid.attributes.position;
  const uv = solid.attributes.uv;
  for (let i = 0; i < sp.count; i++) {
    sp.setZ(i, depthAt(uv.getX(i) * w, (1 - uv.getY(i)) * h));
  }

  const texture = new THREE.Texture(img);
  texture.needsUpdate = true;

  return { count, base: new Float32Array(base), lum: new Float32Array(lum), sphere, fuzz, solid, texture };
}

/**
 * Un paso de la física del hover para el punto i: el cursor lo empuja hacia
 * afuera y un resorte lo regresa a (rx, ry, rz). Escribe la posición final en
 * out y cuánto se alejó (0..1) en glow.
 */
function springStep(body, i, rx, ry, rz, mouse, dt, spring, damping) {
  const { offset, velocity, out, glow } = body;
  const i3 = i * 3;
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
  if (d2 < RADIUS * RADIUS) {
    const d = Math.sqrt(d2) + 1e-4;
    const f = (1 - d / RADIUS) ** 2 * FORCE * dt;
    // Se hunde hacia el fondo y se abre apenas hacia los lados: una abolladura, no un hueco
    vx += (dx / d) * f * 0.35;
    vy += (dy / d) * f * 0.35;
    vz -= f;
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
  out[i3] = rx + ox;
  out[i3 + 1] = ry + oy;
  out[i3 + 2] = rz + oz;
  glow[i] = Math.min(1, Math.sqrt(ox * ox + oy * oy + oz * oz) * 5);
}

/** Estado de la física para los puntos que se dibujan desde el arreglo out */
const createBody = (out) => {
  const n = out.length / 3;
  return { out, offset: new Float32Array(n * 3), velocity: new Float32Array(n * 3), glow: new Float32Array(n) };
};

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

      sampleImage(IMAGE).then(({ count, base, lum, sphere, fuzz, solid, texture }) => {
        if (cancelled) return;

        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0, 8);
        const stage = createStage(canvasBox.current, { camera });

        // Todo va dentro de un grupo: así la inclinación y la posición se aplican a ambos
        const group = new THREE.Group();
        stage.scene.add(group);

        // --- Pluma sólida ---
        const solidBase = solid.attributes.position.array.slice();
        const solidBody = createBody(solid.attributes.position.array);
        const solidPos = solid.attributes.position.setUsage(THREE.DynamicDrawUsage);
        const solidGlow = new THREE.BufferAttribute(solidBody.glow, 1).setUsage(THREE.DynamicDrawUsage);
        solid.setAttribute("aGlow", solidGlow);
        const solidUniforms = { uMap: { value: texture }, uOpacity: { value: 1 } };
        const mesh = new THREE.Mesh(
          solid,
          new THREE.ShaderMaterial({
            uniforms: solidUniforms,
            vertexShader: solidVertexShader,
            fragmentShader: solidFragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
          })
        );
        mesh.frustumCulled = false;
        group.add(mesh);

        // --- Partículas (solo visibles durante el cambio a esfera) ---
        const body = createBody(new Float32Array(base));
        const random = new Float32Array(count).map(() => Math.random());

        const geo = new THREE.BufferGeometry();
        const posAttr = new THREE.BufferAttribute(body.out, 3).setUsage(THREE.DynamicDrawUsage);
        const glowAttr = new THREE.BufferAttribute(body.glow, 1).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("position", posAttr);
        geo.setAttribute("aGlow", glowAttr);
        geo.setAttribute("aLum", new THREE.BufferAttribute(lum, 1));
        geo.setAttribute("aRandom", new THREE.BufferAttribute(random, 1));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

        const pointUniforms = { uPixelRatio: { value: stage.renderer.getPixelRatio() }, uOpacity: { value: 0 } };
        const points = new THREE.Points(
          geo,
          new THREE.ShaderMaterial({
            uniforms: pointUniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        group.add(points);

        // Pantallas anchas: la pluma va a la derecha para no tapar el texto.
        // Pantallas angostas: la cámara se aleja para que quepa.
        stage.add({
          onResize: (w, h) => {
            camera.position.z = w / h < 0.9 ? 8 / (w / h / 0.9) : 8;
            group.position.x = w / h > 1.2 ? 1.5 : 0;
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
            group.worldToLocal(hit);
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
        const solidCount = solidPos.count;
        let last = 0;

        stage.add({
          onFrame: (t) => {
            const dt = Math.min((t - last) * 60, 3); // 1 = un frame a 60 fps
            last = t;
            group.rotation.x = tilt.x;
            group.rotation.y = tilt.y + (reduced ? 0 : Math.sin(t * 0.4) * 0.08);

            const m = morph.value;
            const spring = SPRING * dt;
            const damping = Math.pow(DAMPING, dt);

            // Al empezar el cambio, la superficie se desvanece y aparecen las partículas
            const solidOpacity = 1 - THREE.MathUtils.smoothstep(m, 0.02, 0.16);
            solidUniforms.uOpacity.value = solidOpacity;
            pointUniforms.uOpacity.value = THREE.MathUtils.smoothstep(m, 0, 0.1);
            mesh.visible = solidOpacity > 0;
            points.visible = m > 0;

            if (mesh.visible) {
              for (let i = 0; i < solidCount; i++) {
                const i3 = i * 3;
                springStep(solidBody, i, solidBase[i3], solidBase[i3 + 1], solidBase[i3 + 2], mouse, dt, spring, damping);
              }
              solidPos.needsUpdate = true;
              solidGlow.needsUpdate = true;
            }

            if (points.visible) {
              for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                // Mezcla pluma/bola, desfasada por partícula para que no viajen todas juntas
                let k = (m - random[i] * 0.35) / 0.65;
                k = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
                // Pelusa: máxima a mitad del viaje (k = 0.5), nula en la pluma y en la esfera
                const p = k * (1 - k) * 4;
                springStep(
                  body,
                  i,
                  base[i3] + (sphere[i3] - base[i3]) * k + fuzz[i3] * p,
                  base[i3 + 1] + (sphere[i3 + 1] - base[i3 + 1]) * k + fuzz[i3 + 1] * p,
                  base[i3 + 2] + (sphere[i3 + 2] - base[i3 + 2]) * k + fuzz[i3 + 2] * p,
                  mouse,
                  dt,
                  spring,
                  damping
                );
              }
              posAttr.needsUpdate = true;
              glowAttr.needsUpdate = true;
            }
          },
        });

        gsap.from(group.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 1.6, ease: "expo.out", delay: 0.6 });

        cleanup = () => {
          section.removeEventListener("pointermove", onMove);
          section.removeEventListener("pointerleave", onLeave);
          texture.dispose();
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
        <p className="eyebrow">Hover + scroll · Sólido → partículas</p>
        <div className="pluma-steps">
          <h2 className="pluma-step pluma-step-1">Pasa el cursor sobre la pluma y haz scroll ↓</h2>
          <h2 className="pluma-step pluma-step-2">Se deshace en una esfera de partículas…</h2>
          <h2 className="pluma-step pluma-step-3">…y vuelve a su forma original.</h2>
        </div>
      </div>
    </section>
  );
}
