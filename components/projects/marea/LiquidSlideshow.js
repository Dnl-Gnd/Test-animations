"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { createStage } from "@/lib/createStage";
import { simplexNoise3D } from "@/lib/glsl/noise";
import { drawArt } from "@/lib/art";

gsap.registerPlugin(ScrollTrigger);

const SLIDES = [
  { title: "Costa", a: "#0f7c8c", b: "#b6f0ff" },
  { title: "Oleaje", a: "#1b3cff", b: "#7cffd4" },
  { title: "Arrecife", a: "#ff8a5c", b: "#0f7c8c" },
  { title: "Abismo", a: "#051a2e", b: "#3056ff" },
];

/**
 * MAREA B — Imágenes que cambian con distorsión líquida.
 * Un plano a pantalla completa con dos texturas: la actual y la siguiente.
 * uProgress (0..1) mezcla ambas; mientras cambia, un ruido desplaza las
 * coordenadas de cada imagen en sentidos opuestos, como si el agua las
 * arrastrara. La sección se fija y el scroll recorre las 4 imágenes: el
 * índice entero elige las texturas y la parte decimal es el progreso.
 * Las coordenadas se ajustan tipo "object-fit: cover" para no deformar la imagen.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTex1;
  uniform sampler2D uTex2;
  uniform float uProgress;
  uniform float uTime;
  uniform vec2  uCover;   // escala para simular object-fit: cover
  varying vec2 vUv;

  ${simplexNoise3D}

  void main() {
    vec2 uv = (vUv - 0.5) * uCover + 0.5;
    float p = uProgress;

    // Ruido que "empuja" la imagen; es máximo a mitad de la transición
    float n = snoise(vec3(uv * 3.0, uTime * 0.3));
    float wave = sin(p * 3.14159);
    vec2 offset = vec2(n, snoise(vec3(uv * 3.0 + 7.0, uTime * 0.3))) * 0.12 * wave;

    vec4 a = texture2D(uTex1, uv + offset * p);
    vec4 b = texture2D(uTex2, uv - offset * (1.0 - p));

    // Borde de mezcla ondulado que baja desde arriba
    float edge = smoothstep(p - 0.15, p + 0.15, 1.0 - vUv.y + n * 0.15 * wave);
    gl_FragColor = mix(b, a, edge);
  }
`;

export default function LiquidSlideshow() {
  const wrap = useRef(null);
  const canvasBox = useRef(null);
  const counter = useRef(null);
  const title = useRef(null);

  useGSAP(
    () => {
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const stage = createStage(canvasBox.current, { camera, alpha: false });

      const IMG_W = 1600;
      const IMG_H = 1000;
      const textures = SLIDES.map((s, i) => {
        const tex = new THREE.CanvasTexture(drawArt({ ...s, seed: i * 3 + 1, width: IMG_W, height: IMG_H }));
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      });

      const uniforms = {
        uTex1: { value: textures[0] },
        uTex2: { value: textures[1] },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uCover: { value: new THREE.Vector2(1, 1) },
      };
      stage.scene.add(
        new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }))
      );

      stage.add({
        onFrame: (t) => (uniforms.uTime.value = t),
        onResize: (w, h) => {
          // object-fit: cover — recorta el lado que sobra
          const screen = w / h;
          const img = IMG_W / IMG_H;
          uniforms.uCover.value.set(screen < img ? screen / img : 1, screen < img ? 1 : img / screen);
        },
      });

      const state = { index: 0 };
      let current = -1;
      const setSlide = (i) => {
        if (i === current) return;
        current = i;
        if (counter.current) counter.current.textContent = String(i + 1).padStart(2, "0");
        if (title.current) {
          gsap.fromTo(title.current, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "expo.out" });
          title.current.textContent = SLIDES[i].title;
        }
      };
      setSlide(0);

      gsap.to(state, {
        index: SLIDES.length - 1,
        ease: "none",
        scrollTrigger: {
          trigger: wrap.current,
          start: "top top",
          end: `+=${(SLIDES.length - 1) * 100}%`,
          scrub: 1,
          pin: true,
          // Pequeño "imán" hacia cada imagen cuando dejas de hacer scroll
          snap: { snapTo: 1 / (SLIDES.length - 1), duration: 0.6, ease: "power2.inOut" },
        },
        onUpdate: () => {
          const i = Math.min(Math.floor(state.index), SLIDES.length - 2);
          uniforms.uTex1.value = textures[i];
          uniforms.uTex2.value = textures[i + 1];
          uniforms.uProgress.value = state.index - i;
          setSlide(Math.round(state.index));
        },
      });

      return () => {
        textures.forEach((t) => t.dispose());
        stage.destroy();
      };
    },
    { scope: wrap }
  );

  return (
    <section ref={wrap} className="liquid-section">
      <div ref={canvasBox} className="canvas-fill" />
      <div className="liquid-copy">
        <p className="eyebrow">Marea · 02 · Transición líquida</p>
        <span className="liquid-title-mask">
          <span ref={title} className="liquid-title">Costa</span>
        </span>
      </div>
      <p className="liquid-counter">
        <span ref={counter}>01</span> / {String(SLIDES.length).padStart(2, "0")}
      </p>
    </section>
  );
}
