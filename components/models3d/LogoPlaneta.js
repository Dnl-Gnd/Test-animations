"use client";

import { useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";

gsap.registerPlugin(ScrollTrigger);

const MODEL = "/3d/logo-planeta.glb"; // generado con blender/logo_planeta.py
const PLANET_RADIUS = 1.75; // igual que en el script de Blender
const SHELL = 1.03; // esfera lisa que tapa los pliegues del planeta
const LOGO_BLUE = new THREE.Color("#3355ee");
const BASE_ROT = { x: 0.1, y: -0.38 }; // pose final del logo (ligeramente de lado, como el render)

/**
 * LOGO PLANETA — un planeta que se derrite y se convierte en el logo.
 * 1. El modelo viene de Blender: la malla del logo + un shape key "Planeta"
 *    (la misma malla inflada como esfera). En three.js es un morph target:
 *    morphTargetInfluences[0] = 1 → planeta, 0 → logo.
 * 2. El material es el MeshPhysicalMaterial del logo, extendido con
 *    onBeforeCompile: pinta océanos, continentes y nubes según la dirección de
 *    cada punto, y a mitad del cambio ondula la superficie con ruido (efecto líquido).
 * 3. Una esfera lisa (cascarón) cubre el planeta al inicio y se disuelve con
 *    ruido cuando empieza el morph; así no se notan los pliegues de la malla.
 * 4. Fondo: fragment shader a pantalla completa con nébulas (fbm + domain
 *    warping) y estrellas que titilan.
 */

// ---------------------------------------------------------------------------
// Fondo: nébulas animadas + estrellas
// ---------------------------------------------------------------------------
const nebulaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0); // pegado al fondo, ignora la cámara
  }
`;

const nebulaFragment = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uRes;
  varying vec2 vUv;
  ${simplexNoise3D}

  float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * snoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // Una capa de estrellas: una por celda (si el hash lo permite), con brillo que titila
  float stars(vec2 p, float density, float size) {
    vec2 id = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = hash(id);
    vec2 offset = vec2(hash(id + 7.3), hash(id + 1.9)) - 0.5;
    float d = length(f - offset * 0.7);
    float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
    return step(1.0 - density, h) * smoothstep(size, 0.0, d) * twinkle;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0;
    p.y += uScroll * 0.35; // parallax suave con el scroll
    float t = uTime * 0.025;

    // Domain warping: el ruido deforma las coordenadas de otro ruido → formas de gas
    vec3 q = vec3(p * 0.8, t);
    vec2 warp = vec2(fbm(q), fbm(q + vec3(5.2, 1.3, 2.0)));
    float gas = fbm(vec3(p * 0.9 + warp * 1.5, t * 1.4));
    float gas2 = fbm(vec3(p * 1.6 - warp * 0.8, t * 2.0 + 10.0));
    float dust = fbm(vec3(p * 2.6 + warp, t + 30.0));

    vec3 col = vec3(0.004, 0.006, 0.025);
    col += vec3(0.06, 0.12, 0.6) * smoothstep(-0.05, 0.75, gas) * 0.85;      // azul
    col += vec3(0.42, 0.14, 0.72) * smoothstep(0.15, 0.85, gas2) * 0.55;     // violeta
    col += vec3(0.95, 0.45, 0.7) * pow(smoothstep(0.35, 0.9, gas * gas2 * 2.2), 2.0) * 0.35; // núcleo rosado
    col *= 0.55 + 0.45 * smoothstep(-0.45, 0.25, dust);                       // franjas de polvo

    vec2 sp = p + vec2(uTime * 0.004, 0.0);
    col += vec3(0.85, 0.9, 1.0) * stars(sp * 90.0, 0.06, 0.09);
    col += vec3(0.7, 0.8, 1.0) * stars(sp * 45.0 + 3.0, 0.04, 0.07) * 0.8;
    col += vec3(1.0, 0.95, 0.9) * stars(sp * 18.0 + 9.0, 0.025, 0.06) * 1.2;

    col *= 1.0 - 0.45 * dot(vUv - 0.5, vUv - 0.5) * 2.0; // viñeta
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Color del planeta (compartido por la malla y el cascarón)
// ---------------------------------------------------------------------------
const planetGLSL = /* glsl */ `
  ${simplexNoise3D}
  float pfbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * snoise(p); p *= 2.1; a *= 0.5; }
    return s;
  }
  // dir: dirección desde el centro del planeta (unitaria)
  vec3 planetColor(vec3 dir, float time) {
    float land = pfbm(dir * 1.7);
    vec3 deep = vec3(0.006, 0.02, 0.12);
    vec3 coast = vec3(0.02, 0.1, 0.42);
    vec3 ground = vec3(0.1, 0.3, 0.9);
    vec3 c = mix(deep, coast, smoothstep(-0.05, 0.05, land));
    c = mix(c, ground, smoothstep(0.08, 0.3, land));
    // Nubes: giran un poco más rápido que el planeta
    float a = time * 0.03;
    vec3 cd = vec3(dir.x * cos(a) - dir.z * sin(a), dir.y, dir.x * sin(a) + dir.z * cos(a));
    float clouds = smoothstep(0.15, 0.55, pfbm(cd * 3.0 + 4.0)) * 0.8;
    return mix(c, vec3(0.8, 0.86, 1.0), clouds);
  }
`;

const shellVertex = /* glsl */ `
  varying vec3 vDir;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vDir = normalize(position);
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const shellFragment = /* glsl */ `
  uniform float uTime;
  uniform float uDissolve; // 0 = entero, 1 = disuelto
  uniform vec3 uLightDir;
  varying vec3 vDir;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  ${planetGLSL}

  void main() {
    // Se disuelve con ruido: los huecos se abren desde manchas al azar, con borde brillante
    float n = snoise(vDir * 2.5 + uTime * 0.1) * 0.5 + 0.5;
    float edge = uDissolve * 1.15;
    if (n < edge - 0.08) discard;
    float rim = smoothstep(edge, edge - 0.08, n);

    vec3 nrm = normalize(vNormalV);
    vec3 viewDir = normalize(-vViewPos);
    float diff = max(dot(nrm, normalize(uLightDir)), 0.0);
    vec3 col = planetColor(vDir, uTime) * (0.12 + diff * 1.1);
    float fres = pow(1.0 - max(dot(nrm, viewDir), 0.0), 3.0);
    col += vec3(0.3, 0.55, 1.0) * fres * 0.9;           // atmósfera
    col += vec3(0.5, 0.75, 1.0) * rim * 2.0 * step(0.001, uDissolve); // borde que se derrite
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Halo de atmósfera (cara trasera de una esfera un poco más grande)
const haloVertex = /* glsl */ `
  varying vec3 vNormalV;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const haloFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vNormalV;
  void main() {
    float i = pow(max(0.7 + dot(vNormalV, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
    gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * i, i * uOpacity);
  }
`;

/**
 * Extiende el material físico del logo: color de planeta + superficie líquida.
 */
function createLogoMaterial(uniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    color: LOGO_BLUE,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uMorph;
        uniform float uTime;
        varying vec3 vPlanetDir;
        ${simplexNoise3D}`
      )
      .replace(
        "#include <morphtarget_vertex>",
        `#include <morphtarget_vertex>
        vPlanetDir = normalize(transformed);
        // Ondas líquidas: máximas a mitad del cambio, nulas en el planeta y en el logo
        float liquid = sin(3.14159 * uMorph);
        float wave = snoise(transformed * 1.1 + vec3(0.0, uTime * 0.7, 0.0));
        transformed += objectNormal * wave * 0.16 * liquid * liquid;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uMorph;
        uniform float uTime;
        varying vec3 vPlanetDir;
        ${planetGLSL}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float planetMix = smoothstep(0.15, 0.85, uMorph);
        diffuseColor.rgb = mix(diffuseColor.rgb, planetColor(normalize(vPlanetDir), uTime), planetMix);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.65, planetMix);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - abs(dot(normal, normalize(-vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.3, 0.55, 1.0) * fres * 0.8 * planetMix;`
      );
  };
  return material;
}

export default function LogoPlaneta() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);

  useGSAP(
    () => {
      let cancelled = false;
      let cleanup = () => {};

      // morph: 1 = planeta, 0 = logo. Sección fijada; el scroll lo lleva de uno a otro.
      const state = { morph: 1, progress: 0 };
      gsap
        .timeline({
          scrollTrigger: {
            trigger: wrap.current,
            start: "top top",
            end: "+=260%",
            scrub: 1,
            pin: true,
            onUpdate: (self) => (state.progress = self.progress),
          },
        })
        .to({}, { duration: 0.25 }) // el planeta gira un momento antes de cambiar
        .to(".planeta-step-1", { autoAlpha: 0, y: -30, duration: 0.15 }, 0.2)
        .to(state, { morph: 0, duration: 1, ease: "power1.inOut" }, 0.25)
        .fromTo(".planeta-step-2", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.15 }, 0.4)
        .to(".planeta-step-2", { autoAlpha: 0, y: -30, duration: 0.15 }, 0.95)
        .fromTo(".planeta-step-3", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.15 }, 1.15)
        .to({}, { duration: 0.3 }); // pausa final con el logo completo

      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 10.5);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      const { renderer, scene } = stage;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      // Reflejos del barniz: un entorno de estudio tenue
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;
      scene.environmentIntensity = 0.35;

      // --- Fondo ---
      const nebulaUniforms = { uTime: { value: 0 }, uScroll: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
      const nebula = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: nebulaUniforms,
          vertexShader: nebulaVertex,
          fragmentShader: nebulaFragment,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        })
      );
      nebula.frustumCulled = false;
      nebula.renderOrder = -1;
      scene.add(nebula);

      // --- Luces (como en la escena de Blender) ---
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(-4, 5, 6);
      const rim = new THREE.DirectionalLight(0x5980ff, 2.2);
      rim.position.set(5, -2, -4);
      const fill = new THREE.DirectionalLight(0x99b3ff, 0.6);
      fill.position.set(6, -3, 5);
      scene.add(key, rim, fill, new THREE.AmbientLight(0x1a2a66, 0.4));

      // Grupo: posición en pantalla + inclinación con el mouse
      const group = new THREE.Group();
      const spinner = new THREE.Group(); // giro del planeta
      group.add(spinner);
      scene.add(group);

      const uniforms = { uMorph: { value: 1 }, uTime: { value: 0 } };

      // Cascarón: esfera lisa que se disuelve al empezar el morph
      const shellUniforms = {
        uTime: uniforms.uTime,
        uDissolve: { value: 0 },
        uLightDir: { value: new THREE.Vector3() },
      };
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(PLANET_RADIUS * SHELL, 96, 64),
        new THREE.ShaderMaterial({ uniforms: shellUniforms, vertexShader: shellVertex, fragmentShader: shellFragment })
      );
      // Se agrega dentro de la malla del logo al cargarla, para compartir sus
      // coordenadas locales: así continentes y nubes coinciden exactamente.

      const haloUniforms = { uOpacity: { value: 1 } };
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(PLANET_RADIUS * 1.12, 64, 32),
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
      group.add(halo);

      // Pantallas anchas: el modelo va a la derecha para no tapar el texto.
      stage.add({
        onResize: (w, h) => {
          nebulaUniforms.uRes.value.set(w, h);
          camera.position.z = w / h < 0.9 ? 10.5 / (w / h / 0.9) : 10.5;
          group.position.x = w / h > 1.2 ? 1.4 : 0;
        },
      });

      // Mouse → inclinación suave
      const tilt = { x: 0, y: 0 };
      const tiltX = gsap.quickTo(tilt, "x", { duration: 1.2, ease: "power3.out" });
      const tiltY = gsap.quickTo(tilt, "y", { duration: 1.2, ease: "power3.out" });
      const section = wrap.current;
      const onMove = (e) => {
        const rect = section.getBoundingClientRect();
        tiltX((((e.clientY - rect.top) / rect.height) * 2 - 1) * 0.15);
        tiltY((((e.clientX - rect.left) / rect.width) * 2 - 1) * 0.3);
      };
      const onLeave = () => {
        tiltX(0);
        tiltY(0);
      };
      section.addEventListener("pointermove", onMove);
      section.addEventListener("pointerleave", onLeave);

      const reduced = prefersReducedMotion();
      let logoMesh = null;
      const lightDir = new THREE.Vector3();

      stage.add({
        onFrame: (t) => {
          const time = reduced ? 0 : t;
          const m = state.morph;
          uniforms.uTime.value = time;
          uniforms.uMorph.value = m;
          nebulaUniforms.uTime.value = time;
          nebulaUniforms.uScroll.value = state.progress;

          // Cascarón: entero hasta m = 0.95, disuelto en m = 0.78
          const dissolve = 1 - THREE.MathUtils.smoothstep(m, 0.78, 0.95);
          shellUniforms.uDissolve.value = dissolve;
          shell.visible = dissolve < 1 && logoMesh !== null;
          haloUniforms.uOpacity.value = THREE.MathUtils.smoothstep(m, 0.3, 0.9);
          halo.visible = haloUniforms.uOpacity.value > 0.001;
          if (logoMesh) logoMesh.morphTargetInfluences[0] = m;

          // Giro: el planeta rota (tiempo + scroll) y se detiene de frente al formarse el logo
          spinner.rotation.y = BASE_ROT.y - m * Math.PI * 2 - time * 0.12 * m * m;
          spinner.rotation.x = BASE_ROT.x * (1 - m) + 0.25 * m;
          group.rotation.x = tilt.x;
          group.rotation.y = tilt.y;

          // Dirección de la luz principal en espacio de cámara (para el cascarón)
          lightDir.copy(key.position).normalize().transformDirection(camera.matrixWorldInverse);
          shellUniforms.uLightDir.value.copy(lightDir);
        },
      });

      new GLTFLoader().load(MODEL, (gltf) => {
        if (cancelled) return;
        gltf.scene.traverse((obj) => {
          if (obj.isMesh && obj.morphTargetInfluences) logoMesh = obj;
        });
        if (!logoMesh) return;
        logoMesh.material.dispose();
        logoMesh.material = createLogoMaterial(uniforms);
        logoMesh.morphTargetInfluences[0] = 1;
        logoMesh.frustumCulled = false;
        logoMesh.add(shell);
        spinner.add(gltf.scene);
        gsap.from(group.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 1.6, ease: "expo.out" });
      });

      cleanup = () => {
        section.removeEventListener("pointermove", onMove);
        section.removeEventListener("pointerleave", onLeave);
        envTexture.dispose();
        pmrem.dispose();
        stage.destroy();
      };

      return () => {
        cancelled = true;
        cleanup();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="planeta-section">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="planeta-copy">
        <p className="eyebrow">Scroll · Planeta → logo</p>
        <div className="planeta-steps">
          <h2 className="planeta-step planeta-step-1">Un planeta flota entre nébulas. Haz scroll ↓</h2>
          <h2 className="planeta-step planeta-step-2">Su superficie se vuelve líquida…</h2>
          <h2 className="planeta-step planeta-step-3">…y toma la forma de la marca.</h2>
        </div>
      </div>
    </section>
  );
}
