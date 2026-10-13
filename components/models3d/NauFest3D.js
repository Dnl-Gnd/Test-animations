"use client";

import "@fontsource/montserrat/400-italic.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/800-italic.css";
import { useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";
import { NAU_FEST } from "@/lib/naufestShapes";

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Evento
// ---------------------------------------------------------------------------
const REGISTER_URL = "https://juniorachievementelsalvador.my.site.com/naufest2026/s/";
const AREAS = ["Emprendimiento", "Inteligencia artificial", "Sostenibilidad", "Tendencias laborales"];
const EVENT = {
  date: "24 de octubre",
  time: "8:00 am a 12:00 md",
  place: "Campus JA",
  address: "Final 11 Avenida Sur, Carretera al Puerto de La Libertad, Boulevard Sur, Colonia Utila, Santa Tecla.",
};

// ---------------------------------------------------------------------------
// Estilo del logo
// ---------------------------------------------------------------------------
const TEAL = "#00c1ca";
const LIGHT = "#bdf1f4";
const DEPTH = 0.34; // grosor de las letras
const STROKE_ORDER = ["F1", "F2", "F3", "E1", "E2", "E3", "E4", "S1", "T1", "T2"];
const STROKE_RADIUS = 0.09;

/**
 * NAU FEST 3D
 * 1. Las letras NAU se reconstruyeron del PNG como polígonos con esquinas
 *    redondeadas (lib/naufestShapes.js). Cada letra tiene tres capas, igual que
 *    el logo: la letra sólida (ExtrudeGeometry con bisel), la capa translúcida
 *    (una lámina de vidrio delante) y el contorno fino desplazado (Line2).
 * 2. FEST son tubos que siguen cada trazo del pincel: el tubo se aplana (como
 *    una cerda de pincel), se adelgaza en las puntas y se pinta con un degradado
 *    lima → verde → turquesa con vetas de ruido. Un uniform recorta cada trazo
 *    para "pintarlo" de principio a fin.
 * 3. Con el scroll (sección fijada) las letras llegan girando desde lejos, las
 *    capas se juntan, los contornos se dibujan y FEST se pinta trazo a trazo;
 *    al final aparece 2026. Ya armado, el logo se inclina con el mouse.
 */

// Material de los trazos de pincel: degradado + vetas + recorte para "pintarlo"
function createBrushMaterial(seed) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.0 });
  const uniforms = { uDraw: { value: 0 }, uSeed: { value: seed } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vBrushUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBrushUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uDraw;
        uniform float uSeed;
        varying vec2 vBrushUv;
        ${simplexNoise3D}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (vBrushUv.x > uDraw) discard;
        // Vetas a lo largo del trazo (como las cerdas de un pincel)
        float across = vBrushUv.y;
        float streak = snoise(vec3(vBrushUv.x * 3.0 + uSeed, across * 9.0, uSeed)) * 0.5 + 0.5;
        float fine = snoise(vec3(vBrushUv.x * 14.0, across * 26.0, uSeed + 5.0)) * 0.5 + 0.5;
        vec3 lime = vec3(0.86, 0.94, 0.16);
        vec3 green = vec3(0.30, 0.78, 0.22);
        vec3 teal = vec3(0.07, 0.76, 0.72);
        float g = clamp(vBrushUv.x * 0.9 + (streak - 0.5) * 0.9 + uSeed * 0.07, 0.0, 1.0);
        vec3 c = mix(lime, green, smoothstep(0.15, 0.6, g));
        c = mix(c, teal, smoothstep(0.55, 0.95, g));
        c = mix(c, lime, smoothstep(0.62, 0.9, fine) * 0.6);
        diffuseColor.rgb = c;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.22;"
      );
  };
  return { material, uniforms };
}

/** Tubo aplanado y con puntas redondeadas que sigue un trazo de pincel. */
function createBrushStroke(points, z, radius) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y], i) => new THREE.Vector3(x, y, z + Math.sin(i * 1.7) * 0.03)),
    false,
    "centripetal"
  );
  const segments = Math.max(80, Math.round(curve.getLength() * 60));
  const radial = 14;
  const geo = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const pos = geo.attributes.position;
  const center = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, center);
    // Puntas redondeadas (semicírculo) + el trazo se afina hacia el final
    const capIn = Math.min(u / 0.03, 1);
    const capOut = Math.min((1 - u) / 0.05, 1);
    const cap = Math.sqrt(1 - (1 - capIn) ** 2) * Math.sqrt(1 - (1 - capOut) ** 2);
    const taper = (1.05 - u * 0.4) * Math.max(cap, 0.02);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      offset.fromBufferAttribute(pos, k).sub(center);
      offset.multiplyScalar(taper);
      offset.z *= 0.42; // plano, como una pincelada
      pos.setXYZ(k, center.x + offset.x, center.y + offset.y, center.z + offset.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Contorno fino de una forma, como Line2 (grosor en píxeles) que se puede "dibujar". */
function createOutline(points, color, width) {
  const flat = [];
  [...points, points[0]].forEach(([x, y]) => flat.push(x, y, 0));
  const geo = new LineGeometry();
  geo.setPositions(flat);
  let length = 0;
  for (let i = 1; i < points.length + 1; i++) {
    const a = points[i - 1];
    const b = points[i % points.length];
    length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const material = new LineMaterial({
    color,
    linewidth: width,
    transparent: true,
    opacity: 0.9,
    dashed: true,
    dashSize: length,
    gapSize: length,
    dashOffset: length, // = oculto; 0 = dibujado completo
  });
  const line = new Line2(geo, material);
  line.computeLineDistances();
  line.userData.length = length;
  return line;
}

const toShape = (points) => new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));

export default function NauFest3D() {
  const wrap = useRef(null);
  const pinRef = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();
      const state = { assemble: 0, merge: 0, draw: 0, paint: 0 };

      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 11);
      const stage = createStage(canvasBox.current, { camera });
      const { renderer, scene } = stage;
      renderer.toneMapping = THREE.NeutralToneMapping; // conserva la saturación del turquesa
      renderer.toneMappingExposure = 1.0;

      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.35;

      const key = new THREE.DirectionalLight(0xffffff, 1.7);
      key.position.set(-3, 4, 6);
      const rim = new THREE.DirectionalLight(0x9ff6ff, 1.4);
      rim.position.set(4, -2, -3);
      scene.add(key, rim, new THREE.AmbientLight(0x0b3b48, 0.6));

      // Grupo del logo: posición en pantalla + inclinación con el mouse
      const logo = new THREE.Group();
      scene.add(logo);

      // --- NAU ---
      const solidMat = new THREE.MeshPhysicalMaterial({
        color: TEAL,
        roughness: 0.28,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
      const lightMat = new THREE.MeshPhysicalMaterial({
        color: LIGHT,
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.62,
        clearcoat: 1,
        depthWrite: false,
      });
      const bevel = { bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 6, curveSegments: 4 };
      const [ox, oy] = NAU_FEST.outlineOffset;
      const lines = [];

      const letters = ["N", "A", "U"].map((name, i) => {
        const group = new THREE.Group();

        const solidGeo = new THREE.ExtrudeGeometry(toShape(NAU_FEST.solid[name]), { depth: DEPTH, ...bevel });
        solidGeo.translate(0, 0, -DEPTH / 2);
        const solid = new THREE.Mesh(solidGeo, solidMat);
        group.add(solid);

        const lightGeo = new THREE.ExtrudeGeometry(toShape(NAU_FEST.light[name]), {
          depth: 0.03,
          bevelEnabled: true,
          bevelThickness: 0.015,
          bevelSize: 0.012,
          bevelSegments: 3,
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.renderOrder = 2;
        group.add(light);

        // Contornos finos de la letra y de su capa translúcida, desplazados como en el logo
        const outline = new THREE.Group();
        [NAU_FEST.solid[name], NAU_FEST.light[name]].forEach((pts) => {
          const line = createOutline(pts, 0xffffff, 1.4);
          lines.push(line);
          outline.add(line);
        });
        group.add(outline);

        // Desde dónde llega cada letra
        const from = {
          x: (i - 1) * 5,
          y: [-3.5, 4, -3][i],
          z: -9,
          rx: [1.4, -1.2, 0.9][i],
          ry: [-2.2, 1.8, 2.6][i],
        };
        logo.add(group);
        return { group, solid, light, outline, from };
      });

      // --- FEST ---
      const strokes = STROKE_ORDER.map((name, i) => {
        const geo = createBrushStroke(NAU_FEST.strokes[name], DEPTH / 2 + 0.22, name === "S1" ? STROKE_RADIUS * 0.85 : STROKE_RADIUS);
        const { material, uniforms } = createBrushMaterial(i * 1.37);
        const mesh = new THREE.Mesh(geo, material);
        mesh.renderOrder = 3;
        logo.add(mesh);
        return { mesh, uniforms };
      });

      // --- Tamaño y posición ---
      const layout = { x: -0.9, y: 0.15, scale: 1 };
      stage.add({
        onResize: (w, h) => {
          lines.forEach((l) => l.material.resolution.set(w, h));
          const aspect = w / h;
          if (aspect > 1.1) {
            layout.x = -0.9;
            layout.y = 0.4;
            layout.scale = 1;
          } else {
            // Pantallas angostas: el logo se achica y va arriba
            layout.x = 0;
            layout.y = 0.9;
            layout.scale = Math.max(0.42, aspect * 0.78);
          }
        },
      });

      // Inclinación con el mouse (solo cuando ya está armado)
      const tilt = { x: 0, y: 0 };
      const tiltX = gsap.quickTo(tilt, "x", { duration: 1.2, ease: "power3.out" });
      const tiltY = gsap.quickTo(tilt, "y", { duration: 1.2, ease: "power3.out" });
      const section = pinRef.current;
      const onMove = (e) => {
        const r = section.getBoundingClientRect();
        tiltX((((e.clientY - r.top) / r.height) * 2 - 1) * 0.18);
        tiltY((((e.clientX - r.left) / r.width) * 2 - 1) * 0.32);
      };
      const onLeave = () => {
        tiltX(0);
        tiltY(0);
      };
      section.addEventListener("pointermove", onMove);
      section.addEventListener("pointerleave", onLeave);

      const ease = (t) => t * t * (3 - 2 * t);
      const clamp01 = (t) => Math.min(1, Math.max(0, t));

      stage.add({
        onFrame: (t) => {
          const time = reduced ? 0 : t;
          const done = state.assemble;

          // Cada letra llega con su propio retraso, girando desde el fondo
          letters.forEach((L, i) => {
            const k = ease(clamp01((state.assemble - i * 0.14) / 0.72));
            const inv = 1 - k;
            L.group.position.set(L.from.x * inv, L.from.y * inv, L.from.z * inv);
            L.group.rotation.set(L.from.rx * inv, L.from.ry * inv, 0);
            L.group.scale.setScalar(0.35 + 0.65 * k);

            // Capas separadas en profundidad → se juntan
            const split = 1 - ease(state.merge);
            L.solid.position.z = 0;
            L.light.position.z = DEPTH / 2 + 0.09 + split * 1.1;
            L.outline.position.set(ox + split * 0.25, oy + split * 0.2, DEPTH / 2 + 0.16 - split * 1.9);
          });

          // Contornos que se dibujan
          lines.forEach((l) => {
            l.material.dashOffset = l.userData.length * (1 - state.draw);
            l.visible = state.draw > 0.001;
          });

          // FEST se pinta trazo a trazo
          const n = strokes.length;
          strokes.forEach((s, i) => {
            const p = clamp01(state.paint * n - i * 0.85);
            s.uniforms.uDraw.value = p >= 1 ? 1.01 : p;
            s.mesh.visible = p > 0;
          });

          // Pose del logo: de lado y lejos → de frente, flotando, con el mouse
          const float = reduced ? 0 : Math.sin(time * 0.8) * 0.05;
          logo.position.set(layout.x, layout.y + float * done, 0);
          logo.scale.setScalar(layout.scale);
          logo.rotation.x = 0.06 + tilt.x * done + (1 - done) * 0.25;
          logo.rotation.y = -0.18 + tilt.y * done - (1 - done) * 0.6;
        },
      });

      // --- Timeline del scroll ---
      gsap
        .timeline({
          scrollTrigger: { trigger: pinRef.current, start: "top top", end: "+=320%", scrub: 1, pin: true },
        })
        .to(".nau-intro", { autoAlpha: 0, y: -40, duration: 0.25 }, 0.15)
        .to(state, { assemble: 1, duration: 1.1, ease: "none" }, 0)
        .to(state, { merge: 1, duration: 0.5, ease: "power2.inOut" }, 0.8)
        .to(state, { draw: 1, duration: 0.6, ease: "power1.inOut" }, 0.95)
        .to(state, { paint: 1, duration: 1.1, ease: "none" }, 1.3)
        .fromTo(".nau-year span", { autoAlpha: 0, x: 60 }, { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.12, ease: "power3.out" }, 2.2)
        .fromTo(".nau-tagline", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" }, 2.45)
        .to({}, { duration: 0.3 });

      // Bloque de información: aparece por partes al llegar
      gsap.from(".nau-info-reveal", {
        autoAlpha: 0,
        y: 40,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".nau-info", start: "top 75%" },
      });

      return () => {
        section.removeEventListener("pointermove", onMove);
        section.removeEventListener("pointerleave", onLeave);
        env.dispose();
        pmrem.dispose();
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <div ref={wrap} className="nau-wrap">
      <section ref={pinRef} className="nau-section">
        <div className="nau-dots" aria-hidden="true" />
        <div className="nau-arc" aria-hidden="true" />
        <div ref={canvasBox} className="canvas-fill" />

        <h2 className="nau-intro">
          ¿Te gustaría <em>prepararte</em>
          <br />
          <em>para el futuro?</em>
        </h2>

        <p className="nau-year" aria-label="2026">
          <span>20</span>
          <span>26</span>
        </p>

        <p className="nau-tagline">
          Evento para <em>jóvenes</em> enfocado en la inspiración, el <mark>aprendizaje y el networking.</mark>
        </p>
      </section>

      <section className="nau-info">
        <p className="nau-goal nau-info-reveal">
          Su objetivo es impulsar <strong>el futuro profesional de los participantes en:</strong>
        </p>
        <ul className="nau-areas">
          {AREAS.map((a) => (
            <li key={a} className="nau-info-reveal">
              <span className="nau-dot" />
              {a}
            </li>
          ))}
        </ul>

        <dl className="nau-facts">
          <div className="nau-info-reveal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm-2 8h14v10H5V10Zm2 2v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Zm-8 4v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z" />
            </svg>
            <dt>Fecha</dt>
            <dd>{EVENT.date}</dd>
          </div>
          <div className="nau-info-reveal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 3v6l5 3 1-1.7-4-2.4V7h-2Z" />
            </svg>
            <dt>Hora</dt>
            <dd>{EVENT.time}</dd>
          </div>
          <div className="nau-info-reveal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 2a5 5 0 0 1 5 5c0 3.3-3.4 8-5 10-1.6-2-5-6.7-5-10a5 5 0 0 1 5-5Zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
            </svg>
            <dt>Lugar</dt>
            <dd>
              {EVENT.place}
              <small>{EVENT.address}</small>
            </dd>
          </div>
        </dl>

        <a className="nau-register nau-info-reveal" href={REGISTER_URL} target="_blank" rel="noreferrer" data-cursor-label="Ir">
          ¡Regístrate!
        </a>
      </section>
    </div>
  );
}
