"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage, prefersReducedMotion } from "@/lib/createStage";

gsap.registerPlugin(ScrollTrigger);

/**
 * GLACIAR A — Bloque de hielo que se rompe en fragmentos con el scroll.
 * La geometría se convierte a "no indexada": cada triángulo tiene sus propios
 * vértices. A cada triángulo se le guarda su centro, un eje de giro y un número
 * aleatorio (atributos por cara). En el vertex shader, uExplode (0..1) aleja
 * cada fragmento de su centro, lo gira sobre su eje y lo hace caer un poco.
 * El fragment shader calcula la normal de cada cara con derivadas (dFdx/dFdy)
 * para un aspecto facetado y aplica un brillo de borde (fresnel) azul hielo.
 * Alrededor cae nieve: puntos que bajan en bucle calculado en el shader.
 */
const iceVertex = /* glsl */ `
  uniform float uExplode;
  uniform float uTime;
  attribute vec3 aCenter;
  attribute vec3 aAxis;
  attribute float aRandom;
  varying vec3 vWorld;
  varying float vRandom;

  // Rotación de un vector alrededor de un eje (fórmula de Rodrigues)
  vec3 rotate(vec3 v, vec3 axis, float angle) {
    float c = cos(angle), s = sin(angle);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }

  void main() {
    float e = smoothstep(aRandom * 0.35, aRandom * 0.35 + 0.65, uExplode);
    vec3 local = position - aCenter;
    local = rotate(local, aAxis, e * (3.0 + aRandom * 6.0));
    local *= 1.0 - e * 0.35;

    vec3 dir = normalize(aCenter + 0.0001);
    vec3 center = aCenter + dir * e * (2.2 + aRandom * 2.5);
    center.y -= e * e * (1.0 + aRandom) * 1.2; // un poco de gravedad
    center += dir * sin(uTime * 1.5 + aRandom * 20.0) * 0.03 * e;

    vec4 world = modelMatrix * vec4(center + local, 1.0);
    vWorld = world.xyz;
    vRandom = aRandom;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const iceFragment = /* glsl */ `
  varying vec3 vWorld;
  varying float vRandom;

  void main() {
    // Normal de la cara a partir de cómo cambia la posición entre píxeles
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    if (dot(n, viewDir) < 0.0) n = -n;

    vec3 light = normalize(vec3(0.6, 0.8, 0.5));
    float diff = max(dot(n, light), 0.0);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.5);
    float spec = pow(max(dot(reflect(-light, n), viewDir), 0.0), 40.0);

    vec3 deep = vec3(0.10, 0.25, 0.65);
    vec3 ice  = vec3(0.70, 0.86, 1.00);
    vec3 col = mix(deep, ice, diff * 0.8 + vRandom * 0.15);
    col += fres * vec3(0.6, 0.85, 1.0) * 0.9 + spec * 0.8;

    gl_FragColor = vec4(col, 0.9);
  }
`;

const snowVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aRandom;
  void main() {
    vec3 p = position;
    // Caída en bucle entre y = 5 y y = -5, con vaivén lateral
    p.y = mod(p.y - uTime * (0.3 + aRandom * 0.4) + 5.0, 10.0) - 5.0;
    p.x += sin(uTime * 0.6 + aRandom * 30.0) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.5 + aRandom * 3.0) * uPixelRatio * (8.0 / -mv.z);
  }
`;

const snowFragment = /* glsl */ `
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vec3(0.85, 0.93, 1.0), smoothstep(0.5, 0.1, d) * 0.8);
  }
`;

function buildShards() {
  // Icosaedro de detalle 5 (720 caras). Ya viene "no indexado": cada triángulo
  // tiene sus 3 vértices propios; con otras geometrías habría que usar toNonIndexed()
  let base = new THREE.IcosahedronGeometry(1.7, 5);
  if (base.index) base = base.toNonIndexed();
  const pos = base.getAttribute("position");
  // Deforma un poco los vértices para que no sea una esfera perfecta
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    v.multiply(new THREE.Vector3(1.0, 1.25, 0.9));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const faces = pos.count / 3;
  const centers = new Float32Array(pos.count * 3);
  const axes = new Float32Array(pos.count * 3);
  const randoms = new Float32Array(pos.count);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let f = 0; f < faces; f++) {
    a.fromBufferAttribute(pos, f * 3);
    b.fromBufferAttribute(pos, f * 3 + 1);
    c.fromBufferAttribute(pos, f * 3 + 2);
    const center = a.clone().add(b).add(c).divideScalar(3);
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const r = Math.random();
    for (let k = 0; k < 3; k++) {
      centers.set([center.x, center.y, center.z], (f * 3 + k) * 3);
      axes.set([axis.x, axis.y, axis.z], (f * 3 + k) * 3);
      randoms[f * 3 + k] = r;
    }
  }
  base.setAttribute("aCenter", new THREE.BufferAttribute(centers, 3));
  base.setAttribute("aAxis", new THREE.BufferAttribute(axes, 3));
  base.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
  base.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  return { geometry: base, faces };
}

export default function IceShatter() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);
  const faceCount = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 9);
      const stage = createStage(canvasBox.current, { camera, alpha: false });
      stage.renderer.setClearColor("#050b1a");

      const uniforms = { uExplode: { value: 0 }, uTime: { value: 0 } };
      const { geometry, faces } = buildShards();
      if (faceCount.current) faceCount.current.textContent = faces.toLocaleString("es");
      const ice = new THREE.Mesh(
        geometry,
        new THREE.ShaderMaterial({ uniforms, vertexShader: iceVertex, fragmentShader: iceFragment, transparent: true, side: THREE.DoubleSide })
      );
      stage.scene.add(ice);

      // Nieve
      const SNOW = 1500;
      const snowPos = new Float32Array(SNOW * 3);
      const snowRnd = new Float32Array(SNOW);
      for (let i = 0; i < SNOW; i++) {
        snowPos.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8], i * 3);
        snowRnd[i] = Math.random();
      }
      const snowGeo = new THREE.BufferGeometry();
      snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
      snowGeo.setAttribute("aRandom", new THREE.BufferAttribute(snowRnd, 1));
      const snowUniforms = { uTime: { value: 0 }, uPixelRatio: { value: stage.renderer.getPixelRatio() } };
      const snow = new THREE.Points(
        snowGeo,
        new THREE.ShaderMaterial({ uniforms: snowUniforms, vertexShader: snowVertex, fragmentShader: snowFragment, transparent: true, depthWrite: false })
      );
      snow.frustumCulled = false;
      stage.scene.add(snow);

      const rot = { x: 0, y: 0 };
      const toX = gsap.quickTo(rot, "x", { duration: 1.4, ease: "power3.out" });
      const toY = gsap.quickTo(rot, "y", { duration: 1.4, ease: "power3.out" });
      const onMove = (e) => {
        toY(((e.clientX / window.innerWidth) * 2 - 1) * 0.7);
        toX(((e.clientY / window.innerHeight) * 2 - 1) * 0.4);
      };
      window.addEventListener("pointermove", onMove);

      const reduced = prefersReducedMotion();
      stage.add({
        onFrame: (t) => {
          uniforms.uTime.value = t;
          snowUniforms.uTime.value = reduced ? 0 : t;
          ice.rotation.y = rot.y + t * 0.15;
          ice.rotation.x = rot.x;
        },
      });

      // Sección fijada: el scroll rompe el hielo y luego lo vuelve a unir
      gsap
        .timeline({ scrollTrigger: { trigger: wrap.current, start: "top top", end: "+=220%", scrub: 1, pin: true } })
        .to(uniforms.uExplode, { value: 1, ease: "power1.inOut", duration: 1 })
        .to(camera.position, { z: 11, ease: "power1.inOut", duration: 1 }, 0)
        .to(".ice-step-1", { autoAlpha: 0, y: -30, duration: 0.2 }, 0.2)
        .fromTo(".ice-step-2", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.35)
        .to(uniforms.uExplode, { value: 0, ease: "power2.inOut", duration: 1 }, 1.3)
        .to(camera.position, { z: 9, ease: "power2.inOut", duration: 1 }, 1.3)
        .to(".ice-step-2", { autoAlpha: 0, y: -30, duration: 0.2 }, 1.3)
        .fromTo(".ice-step-3", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 1.9);

      return () => {
        window.removeEventListener("pointermove", onMove);
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="ice-section">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="ice-copy">
        <p className="eyebrow">Glaciar · 01 · Hielo que se fragmenta</p>
        <div className="ice-steps">
          <h2 className="ice-step ice-step-1">Un bloque de hielo…</h2>
          <h2 className="ice-step ice-step-2">
            …que se rompe en <span ref={faceCount}>720</span> fragmentos…
          </h2>
          <h2 className="ice-step ice-step-3">…y vuelve a unirse.</h2>
        </div>
      </div>
    </section>
  );
}
