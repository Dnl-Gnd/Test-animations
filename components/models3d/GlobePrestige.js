"use client";

import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@fontsource/michroma/400.css";
import { useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";

// ---------------------------------------------------------------------------
// Datos del lugar
// ---------------------------------------------------------------------------
const PLACE = {
  name: "Prestige Collision Repair",
  city: "Whittier",
  lat: 33.91809917383751,
  lon: -118.04711750000001,
  address: ["12425 Carmenita Rd, Whittier, CA", "90605, United States"],
  phone: "+1 (562) 442-4500",
  tel: "+15624424500",
  plusCode: "WX93+65 Whittier, California, USA",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Prestige+Collision+Repair+12425+Carmenita+Rd+Whittier+CA+90605",
  directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=Prestige+Collision+Repair,+12425+Carmenita+Rd,+Whittier,+CA+90605",
};
const MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2741.8371575425713!2d-118.0471175!3d33.9180324!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80c2d3e26c433617%3A0xbd54cb0b0146b321!2sPrestige%20Collision%20Repair!5e1!3m2!1sen!2ssv!4v1791312331837!5m2!1sen!2ssv";
const FILTERS = ["All", "Collision", "Body", "Paint", "Dents"];

const TEX = "/3d/earth/"; // texturas NASA (Blue Marble, Black Marble y nubes)
const CAMERA_DIST = 4.4;
const ARRIVAL_DIST = 1.004; // la cámara termina a ras del suelo (atraviesa las nubes en 1.008)
const SUN = new THREE.Vector3(-1.0, 0.35, 0.25).normalize(); // desde la izquierda: el este de EE. UU. ya de noche

/** Latitud/longitud → punto en una esfera de radio r (mismo mapeo UV que SphereGeometry). */
function latLonToVector(lat, lon, r = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** Rotación del globo que deja (lat, lon) mirando de frente a la cámara (+Z). */
function facingRotation(lat, lon) {
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return { x: THREE.MathUtils.degToRad(lat), y: Math.PI / 2 - theta };
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uLights;
  uniform sampler2D uWater;
  uniform sampler2D uBump;
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform float uCloudShift;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  // Relieve con derivadas de pantalla (misma idea que el bumpMap de three.js)
  vec3 perturb(vec3 pos, vec3 n, float h) {
    vec2 dH = vec2(dFdx(h), dFdy(h));
    vec3 sx = dFdx(pos);
    vec3 sy = dFdy(pos);
    vec3 r1 = cross(sy, n);
    vec3 r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
    return normalize(abs(det) * n - grad);
  }

  void main() {
    float water = texture2D(uWater, vUv).r;
    float h = texture2D(uBump, vUv).r * 0.012 * (1.0 - water);
    vec3 n = perturb(vPosW, normalize(vNormalW), h);
    vec3 v = normalize(cameraPosition - vPosW);

    float sunDot = dot(n, uSun);
    float day = smoothstep(-0.12, 0.28, sunDot);

    vec3 albedo = texture2D(uDay, vUv).rgb;
    // Sombra de las nubes sobre el suelo
    float cloudShadow = texture2D(uClouds, vUv + vec2(uCloudShift - 0.002, 0.001)).r;
    albedo *= 1.0 - cloudShadow * 0.35;

    vec3 lit = albedo * (0.02 + max(sunDot, 0.0) * 1.35);
    // Reflejo del sol en el océano
    vec3 hv = normalize(uSun + v);
    lit += vec3(0.55, 0.7, 1.0) * pow(max(dot(n, hv), 0.0), 140.0) * water * 0.35;

    // Luces de ciudades en el lado nocturno
    float lights = texture2D(uLights, vUv).r;
    vec3 night = vec3(1.0, 0.68, 0.36) * pow(lights, 1.4) * 1.6 + albedo * 0.012;

    vec3 col = mix(night, lit, day);
    // Atmósfera sobre la superficie: azul en el borde, más intensa del lado del sol
    float fres = pow(1.0 - max(dot(normalize(vNormalW), v), 0.0), 2.5);
    col += vec3(0.25, 0.5, 1.0) * fres * (0.15 + 0.85 * smoothstep(-0.35, 0.6, sunDot));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const cloudsFragment = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform float uCloudShift;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    float c = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;
    float sunDot = dot(normalize(vNormalW), uSun);
    vec3 col = vec3(1.0) * (0.03 + max(sunDot, 0.0) * 1.15);
    // Al acercarse mucho las nubes se vuelven niebla que se atraviesa
    gl_FragColor = vec4(col, smoothstep(0.08, 0.7, c) * 0.92 * uOpacity);
  }
`;

const haloVertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vNormalW;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const haloFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform float uOpacity;
  varying vec3 vNormalV;
  varying vec3 vNormalW;
  void main() {
    float i = pow(max(0.55 + dot(vNormalV, vec3(0.0, 0.0, 1.0)), 0.0), 4.0);
    float lit = 0.35 + 0.65 * smoothstep(-0.6, 0.6, dot(-vNormalW, uSun));
    gl_FragColor = vec4(vec3(0.28, 0.5, 1.0) * i * lit * 2.2 * uOpacity, 1.0);
  }
`;

// Fondo: degradado violeta con brillo detrás del globo
const bgVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const bgFragment = /* glsl */ `
  uniform vec2 uGlow;   // centro del brillo (0..1 en pantalla)
  uniform vec2 uRes;
  uniform float uFade;  // 1 = fondo normal, 0 = negro (durante el viaje)
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - uGlow) * vec2(uRes.x / uRes.y, 1.0);
    float d = length(p);
    vec3 col = mix(vec3(0.045, 0.035, 0.13), vec3(0.018, 0.018, 0.035), smoothstep(0.0, 1.0, d));
    col += vec3(0.14, 0.11, 0.5) * exp(-d * d * 5.0) * 0.45;
    col = mix(vec3(0.005, 0.006, 0.02), col, uFade);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Campo de puntos ondulado (como el patrón de semitono del diseño)
const dotsVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y += sin(p.x * 1.3 + uTime * 0.35) * 0.28 + sin(p.z * 2.0 + uTime * 0.5) * 0.1;
    // Banda que barre en diagonal: los puntos fuera de ella se apagan
    float band = 1.0 - smoothstep(0.0, 0.9, abs(p.y - (p.x * 0.45 - 0.9) - sin(p.x * 0.9 + uTime * 0.2) * 0.35));
    vAlpha = band * (0.35 + 0.65 * aSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 2.2 * uPixelRatio * (4.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const dotsFragment = /* glsl */ `
  uniform float uFade;
  varying float vAlpha;
  void main() {
    if (length(gl_PointCoord - 0.5) > 0.5) discard;
    gl_FragColor = vec4(vec3(0.25, 0.48, 1.0) * vAlpha * uFade, 1.0);
  }
`;

// Post-procesado: desenfoque radial ("viaje a gran velocidad")
const postFragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform float uStrength;
  uniform vec2 uCenter;
  varying vec2 vUv;
  void main() {
    vec2 dir = vUv - uCenter;
    int taps = uStrength < 0.001 ? 1 : 28;
    vec3 acc = vec3(0.0);
    float total = 0.0;
    for (int i = 0; i < 28; i++) {
      if (i >= taps) break;
      float t = float(i) / 27.0;
      float w = 1.0 - t * 0.55;
      acc += texture2D(tScene, vUv - dir * t * uStrength * 0.42).rgb * w;
      total += w;
    }
    vec3 col = acc / total;
    // Destello azul hacia los bordes mientras más rápido va
    col += vec3(0.2, 0.35, 0.9) * uStrength * uStrength * smoothstep(0.2, 0.9, length(dir)) * 0.35;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---------------------------------------------------------------------------
// Íconos (SVG en línea)
// ---------------------------------------------------------------------------
const IconPin = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2 9.5 4.5 12 7l2.5-2.5L12 2Zm-7.5 7.5L2 12l2.5 2.5L7 12 4.5 9.5Zm15 0L17 12l2.5 2.5L22 12l-2.5-2.5ZM12 17l-2.5 2.5L12 22l2.5-2.5L12 17Zm0-7.5L9.5 12l2.5 2.5 2.5-2.5L12 9.5Z" />
  </svg>
);
const IconMap = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 4 9 2 3 4v18l6-2 6 2 6-2V2l-6 2Zm0 15.8-6-2V4.2l6 2v13.6Z" />
  </svg>
);

/**
 * GLOBO → PRESTIGE
 * 1. La Tierra es una esfera con un shader propio: textura de día (Blue Marble),
 *    luces de ciudades en el lado nocturno (Black Marble), reflejo del sol en el
 *    agua, relieve, sombra de nubes y atmósfera. Las nubes son una segunda esfera.
 * 2. El pin es HTML: en cada frame se proyecta la latitud/longitud de Whittier a
 *    la pantalla y se oculta cuando queda detrás del globo.
 * 3. Al hacer clic, una timeline de GSAP gira el globo hasta dejar Whittier de
 *    frente, la cámara se lanza hacia el suelo (expo.in = acelera) atravesando
 *    las nubes y un post-procesado aplica desenfoque radial. Al llegar, el mapa
 *    de Google aparece desde el mismo desenfoque y queda a pantalla completa.
 * 4. "Volver al globo" reproduce la misma timeline al revés.
 */
export default function GlobePrestige() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);
  const pinRef = useRef(null);
  const iframeRef = useRef(null);
  const actions = useRef({ travel: () => {}, back: () => {} });
  const [filter, setFilter] = useState("All");

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();
      const state = { align: 0, dist: CAMERA_DIST, blur: 0, mapOpen: false };

      const camera = new THREE.PerspectiveCamera(35, 1, 0.0005, 200);
      camera.position.set(0, 0, CAMERA_DIST);

      // --- Post-procesado: la escena se dibuja en una textura y luego se desenfoca ---
      const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
      const postUniforms = { tScene: { value: target.texture }, uStrength: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) } };
      const postScene = new THREE.Scene();
      const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      postScene.add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({ uniforms: postUniforms, vertexShader: fullscreenVertex, fragmentShader: postFragment })
        )
      );

      const stage = createStage(canvasBox.current, {
        camera,
        alpha: false,
        render: (renderer, scene, cam) => {
          if (state.mapOpen) return; // el mapa tapa el canvas: no hace falta dibujar
          renderer.setRenderTarget(target);
          renderer.render(scene, cam);
          renderer.setRenderTarget(null);
          renderer.render(postScene, postCamera);
        },
      });
      const { renderer, scene } = stage;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      // --- Texturas ---
      const loader = new THREE.TextureLoader();
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const load = (name, srgb = false) => {
        const t = loader.load(TEX + name);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = maxAniso;
        return t;
      };
      const textures = {
        day: load("day.jpg", true),
        lights: load("lights.jpg"),
        water: load("water.jpg"),
        bump: load("bump.jpg"),
        clouds: load("clouds.jpg"),
      };

      // --- Fondo ---
      const bgUniforms = { uGlow: { value: new THREE.Vector2(0.7, 0.62) }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 1 } };
      const bg = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ uniforms: bgUniforms, vertexShader: bgVertex, fragmentShader: bgFragment, depthWrite: false, depthTest: false })
      );
      bg.frustumCulled = false;
      bg.renderOrder = -2;
      scene.add(bg);

      // --- Campo de puntos ---
      const cols = 150;
      const rows = 46;
      const dotPos = new Float32Array(cols * rows * 3);
      const dotSeed = new Float32Array(cols * rows);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const k = i * rows + j;
          dotPos.set([-1 + (i / cols) * 6.5, -2.4 + (j / rows) * 4.2, -1.6 - (j / rows) * 0.8], k * 3);
          dotSeed[k] = Math.random();
        }
      }
      const dotsGeo = new THREE.BufferGeometry();
      dotsGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3));
      dotsGeo.setAttribute("aSeed", new THREE.BufferAttribute(dotSeed, 1));
      const dotsUniforms = { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uFade: { value: 1 } };
      const dots = new THREE.Points(
        dotsGeo,
        new THREE.ShaderMaterial({
          uniforms: dotsUniforms,
          vertexShader: dotsVertex,
          fragmentShader: dotsFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      dots.renderOrder = -1;
      scene.add(dots);

      // --- Tierra ---
      const globe = new THREE.Group(); // posición en pantalla
      const earth = new THREE.Group(); // rotación
      globe.add(earth);
      scene.add(globe);

      const shared = { uSun: { value: SUN }, uCloudShift: { value: 0 } };
      const earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 192, 128),
        new THREE.ShaderMaterial({
          uniforms: {
            ...shared,
            uDay: { value: textures.day },
            uLights: { value: textures.lights },
            uWater: { value: textures.water },
            uBump: { value: textures.bump },
            uClouds: { value: textures.clouds },
          },
          vertexShader: earthVertex,
          fragmentShader: earthFragment,
        })
      );
      earth.add(earthMesh);

      const cloudUniforms = { ...shared, uClouds: { value: textures.clouds }, uOpacity: { value: 1 } };
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(1.008, 160, 100),
        new THREE.ShaderMaterial({
          uniforms: cloudUniforms,
          vertexShader: earthVertex,
          fragmentShader: cloudsFragment,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide, // se ven también desde abajo al atravesarlas
        })
      );
      earth.add(clouds);

      const haloUniforms = { uSun: shared.uSun, uOpacity: { value: 1 } };
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.07, 96, 48),
        new THREE.ShaderMaterial({
          uniforms: haloUniforms,
          vertexShader: haloVertex,
          fragmentShader: haloFragment,
          side: THREE.BackSide,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      globe.add(halo);

      // --- Pose ---
      const pinLocal = latLonToVector(PLACE.lat, PLACE.lon, 1.0);
      const facing = facingRotation(PLACE.lat, PLACE.lon);
      const layout = { x: 1.0, y: 0.38, scale: 1, halfW: 2.4, halfH: 1.4 }; // posición del globo en reposo (se ajusta al tamaño)

      stage.add({
        onResize: (w, h) => {
          const pr = renderer.getPixelRatio();
          target.setSize(Math.floor(w * pr), Math.floor(h * pr));
          bgUniforms.uRes.value.set(w, h);
          const aspect = w / h;
          const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_DIST;
          if (aspect > 1.2) {
            // Globo a la derecha y un poco arriba, como en el diseño
            layout.x = halfH * aspect * 0.4;
            layout.y = halfH * 0.2;
            layout.scale = 1;
          } else {
            // Pantallas angostas: globo arriba al centro, más chico
            layout.x = 0;
            layout.y = halfH * 0.42;
            layout.scale = Math.max(0.55, aspect * 0.85);
          }
          layout.halfH = halfH;
          layout.halfW = halfH * aspect;
        },
      });

      // Inclinación con el mouse
      const tilt = { x: 0, y: 0 };
      const tiltX = gsap.quickTo(tilt, "x", { duration: 1.4, ease: "power3.out" });
      const tiltY = gsap.quickTo(tilt, "y", { duration: 1.4, ease: "power3.out" });
      const section = wrap.current;
      const onMove = (e) => {
        if (state.align > 0) return;
        const r = section.getBoundingClientRect();
        tiltX((((e.clientY - r.top) / r.height) * 2 - 1) * 0.08);
        tiltY((((e.clientX - r.left) / r.width) * 2 - 1) * 0.14);
      };
      section.addEventListener("pointermove", onMove);

      // --- Loop ---
      const tmp = new THREE.Vector3();
      const tmpN = new THREE.Vector3();
      const toCam = new THREE.Vector3();
      const center = new THREE.Vector3();
      const pinEl = pinRef.current;

      stage.add({
        onFrame: (t) => {
          const time = reduced ? 0 : t;
          const a = state.align;
          const ease = a * a * (3 - 2 * a);

          // Reposo: Whittier arriba a la izquierda del centro, con un vaivén lento.
          // Viaje: Whittier exactamente de frente y el globo al centro de la pantalla.
          const idleY = facing.y - 0.42 + Math.sin(time * 0.08) * 0.05 + tilt.y;
          const idleX = facing.x * 0.45 + tilt.x;
          earth.rotation.y = THREE.MathUtils.lerp(idleY, facing.y, ease);
          earth.rotation.x = THREE.MathUtils.lerp(idleX, facing.x, ease);
          globe.position.set(layout.x * (1 - ease), layout.y * (1 - ease), 0);
          globe.scale.setScalar(THREE.MathUtils.lerp(layout.scale, 1, ease));

          camera.position.z = state.dist;
          camera.lookAt(0, 0, 0);

          shared.uCloudShift.value = time * 0.0008;
          dotsUniforms.uTime.value = time;
          dotsUniforms.uFade.value = 1 - ease;
          bgUniforms.uFade.value = 1 - ease * 0.85;
          bgUniforms.uGlow.value.set(0.5 + (layout.x / layout.halfW / 2) * (1 - ease), 0.5 + (layout.y / layout.halfH / 2) * (1 - ease));
          // El halo se apaga al acercarse (ya estamos dentro de la atmósfera)
          haloUniforms.uOpacity.value = THREE.MathUtils.smoothstep(state.dist, 1.15, 1.8);
          postUniforms.uStrength.value = reduced ? 0 : state.blur;

          // Pin: proyecta Whittier a la pantalla
          globe.updateMatrixWorld();
          tmp.copy(pinLocal).applyMatrix4(earth.matrixWorld);
          globe.getWorldPosition(center);
          tmpN.copy(tmp).sub(center).normalize();
          toCam.copy(camera.position).sub(tmp).normalize();
          const facingCam = tmpN.dot(toCam);
          tmp.project(camera);
          const r = section.getBoundingClientRect();
          const sx = (tmp.x * 0.5 + 0.5) * r.width;
          const sy = (-tmp.y * 0.5 + 0.5) * r.height;
          pinEl.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
          pinEl.style.opacity = String(THREE.MathUtils.smoothstep(facingCam, 0.1, 0.35) * (1 - Math.min(a * 4, 1)));
          pinEl.style.pointerEvents = facingCam > 0.2 && a === 0 ? "auto" : "none";
          // El desenfoque sale desde donde está el pin
          postUniforms.uCenter.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
        },
      });

      // --- Timeline del viaje (se reproduce al revés para volver) ---
      const q = gsap.utils.selector(section);
      const tl = gsap.timeline({
        paused: true,
        onComplete: () => {
          state.mapOpen = true;
        },
        onReverseComplete: () => {
          gsap.set(q(".globo-map"), { pointerEvents: "none" });
        },
      });
      tl.to(q(".globo-copy"), { autoAlpha: 0, y: 20, duration: 0.45, ease: "power2.in", stagger: 0.05 }, 0)
        .to(state, { align: 1, duration: 1.1, ease: "power2.inOut" }, 0)
        // La cámara se lanza al suelo: lenta al inicio, cada vez más rápida
        .to(state, { dist: ARRIVAL_DIST, duration: 1.7, ease: "expo.in" }, 0.85)
        .to(state, { blur: 1, duration: 1.3, ease: "power2.in" }, 1.1)
        // Llegada: el mapa aparece desde el mismo desenfoque
        .fromTo(
          q(".globo-map"),
          { autoAlpha: 0, scale: 2.4, filter: "blur(18px) brightness(1.6)" },
          { autoAlpha: 1, scale: 1, filter: "blur(0px) brightness(1)", duration: 1.0, ease: "expo.out", pointerEvents: "auto" },
          2.35
        )
        .fromTo(q(".globo-map-card"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, 2.9)
        // La ficha del taller solo aparece cuando el mapa ya ocupa toda la pantalla
        .fromTo(q(".globo-card"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, 3.35);

      actions.current.travel = () => {
        if (tl.isActive() && !tl.reversed()) return;
        if (!iframeRef.current.src) iframeRef.current.src = MAP_EMBED; // carga el mapa durante el vuelo
        tl.timeScale(reduced ? 3 : 1).play();
      };
      actions.current.back = () => {
        state.mapOpen = false;
        tl.timeScale(reduced ? 3 : 1.35).reverse();
      };

      return () => {
        section.removeEventListener("pointermove", onMove);
        Object.values(textures).forEach((tx) => tx.dispose());
        target.dispose();
        postScene.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  const travel = () => actions.current.travel();
  const back = () => actions.current.back();

  return (
    <section ref={wrap} className="globo-section">
      <div ref={canvasBox} className="canvas-fill" />

      <div className="globo-copy">
        <h2 className="globo-title">
          <span>See the</span>
          <span>Difference</span>
        </h2>
        <ul className="globo-filters">
          {FILTERS.map((f, i) => (
            <li key={f}>
              {i > 0 && <span className="globo-sep">/</span>}
              <button type="button" className={f === filter ? "is-active" : ""} onClick={() => setFilter(f)}>
                {f}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button ref={pinRef} type="button" className="globo-pin" onClick={travel} data-cursor-label="Viajar" aria-label={`Viajar a ${PLACE.name}`}>
        <span className="globo-pin-dot" style={{ backgroundImage: `url(${TEX}whittier.jpg)` }} />
        <span className="globo-pin-label">{PLACE.city}</span>
      </button>

      <article className="globo-card">
        <div className="globo-card-thumb">
          <img src={`${TEX}whittier.jpg`} alt="Vista satelital de Whittier, California" />
        </div>
        <div className="globo-card-body">
          <h3>{PLACE.name}</h3>
          <p>
            <IconPin />
            <span>
              {PLACE.address[0]}
              <br />
              {PLACE.address[1]}
            </span>
          </p>
          <p>
            <IconPhone />
            <a href={`tel:${PLACE.tel}`}>{PLACE.phone}</a>
          </p>
          <p>
            <IconPlus />
            <span>{PLACE.plusCode}</span>
          </p>
          <a className="globo-card-maps" href={PLACE.mapsUrl} target="_blank" rel="noreferrer" aria-label="Abrir en Google Maps">
            <IconMap />
          </a>
        </div>
      </article>

      <div className="globo-map" data-lenis-prevent>
        <iframe
          ref={iframeRef}
          title={`Mapa de ${PLACE.name}`}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="globo-map-card">
          <p className="globo-map-kicker">{PLACE.city}, CA</p>
          <h3>{PLACE.name}</h3>
          <p>{PLACE.address.join(" ")}</p>
          <div className="globo-map-actions">
            <button type="button" className="btn btn-ghost" onClick={back}>
              ← Volver al globo
            </button>
            <a className="btn btn-solid globo-btn-orange" href={PLACE.directionsUrl} target="_blank" rel="noreferrer">
              Cómo llegar
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
