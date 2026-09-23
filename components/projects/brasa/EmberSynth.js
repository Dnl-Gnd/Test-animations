"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

// Escala pentatónica menor de La: todas las notas suenan bien juntas
const NOTES = [
  { name: "La", freq: 220.0, key: "a" },
  { name: "Do", freq: 261.63, key: "s" },
  { name: "Re", freq: 293.66, key: "d" },
  { name: "Mi", freq: 329.63, key: "f" },
  { name: "Sol", freq: 392.0, key: "g" },
  { name: "La", freq: 440.0, key: "h" },
  { name: "Do", freq: 523.25, key: "j" },
];

/**
 * BRASA B — Sonido interactivo con Web Audio API + visualizador.
 * Igual que en Trionn, no hay archivos de audio: cada nota se sintetiza en el
 * momento con tres osciladores senoidales ligeramente desafinados (sonido más
 * "gordo"), una envolvente de volumen (ataque rápido, caída exponencial) y un
 * delay con retroalimentación que deja eco.
 * Un AnalyserNode lee las frecuencias en cada frame y un <canvas> 2D las dibuja
 * como columnas de fuego. Cada nota también lanza chispas con GSAP.
 * El navegador solo permite sonido después de una interacción: el primer clic
 * o tecla crea el AudioContext.
 */
export default function EmberSynth() {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const audio = useRef(null);
  const [enabled, setEnabled] = useState(false);

  // Crea el grafo de audio: notas -> master -> delay (eco) -> analizador -> salida
  const ensureAudio = () => {
    if (audio.current) {
      if (audio.current.ctx.state === "suspended") audio.current.ctx.resume();
      return audio.current;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.35;

    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    master.connect(analyser);
    master.connect(delay);
    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(analyser);
    analyser.connect(ctx.destination);

    audio.current = { ctx, master, analyser, data: new Uint8Array(analyser.frequencyBinCount) };
    setEnabled(true);
    return audio.current;
  };

  const play = (freq) => {
    const { ctx, master } = ensureAudio();
    const now = ctx.currentTime;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.5, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
    env.connect(master);

    [1, 1.006, 0.994].forEach((detune, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = freq * detune;
      osc.connect(env);
      osc.start(now);
      osc.stop(now + 1.7);
    });
  };

  const { contextSafe } = useGSAP(
    () => {
      const cvs = canvas.current;
      const ctx2d = cvs.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio, 2);

      const resize = () => {
        cvs.width = cvs.clientWidth * dpr;
        cvs.height = cvs.clientHeight * dpr;
      };
      resize();
      window.addEventListener("resize", resize);

      // Visualizador: columnas de fuego según la energía de cada frecuencia
      const draw = (time) => {
        const w = cvs.width;
        const h = cvs.height;
        ctx2d.clearRect(0, 0, w, h);
        const bars = 48;
        const bw = w / bars;
        const a = audio.current;
        if (a) a.analyser.getByteFrequencyData(a.data);

        for (let i = 0; i < bars; i++) {
          // Simetría: graves en el centro, agudos hacia los lados
          const idx = Math.floor(Math.abs(i - bars / 2) * 1.2);
          const energy = a ? a.data[idx] / 255 : 0;
          const idle = 0.05 + 0.04 * Math.sin(time * 2 + i * 0.5);
          const v = Math.max(energy, idle);
          const bh = v * h * 0.9;
          const grad = ctx2d.createLinearGradient(0, h, 0, h - bh);
          grad.addColorStop(0, "rgba(255,60,20,0.95)");
          grad.addColorStop(0.6, "rgba(255,150,40,0.85)");
          grad.addColorStop(1, "rgba(255,230,160,0)");
          ctx2d.fillStyle = grad;
          const x = i * bw + bw * 0.15;
          ctx2d.beginPath();
          ctx2d.roundRect(x, h - bh, bw * 0.7, bh, bw * 0.35);
          ctx2d.fill();
        }
      };
      gsap.ticker.add(draw);

      const onKey = (e) => {
        if (e.repeat || e.metaKey || e.ctrlKey) return;
        const i = NOTES.findIndex((n) => n.key === e.key.toLowerCase());
        if (i >= 0) trigger(i);
      };
      window.addEventListener("keydown", onKey);

      return () => {
        gsap.ticker.remove(draw);
        window.removeEventListener("resize", resize);
        window.removeEventListener("keydown", onKey);
        audio.current?.ctx.close();
        audio.current = null;
      };
    },
    { scope: wrap }
  );

  // Nota + animación del pad + chispas
  const trigger = contextSafe((i) => {
    play(NOTES[i].freq);
    const pad = wrap.current.querySelectorAll(".synth-pad")[i];
    gsap.fromTo(pad, { scale: 0.92 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    gsap.fromTo(pad.querySelector(".synth-glow"), { opacity: 1 }, { opacity: 0, duration: 1.2, ease: "power2.out" });

    const r = pad.getBoundingClientRect();
    const host = wrap.current.getBoundingClientRect();
    for (let k = 0; k < 12; k++) {
      const s = document.createElement("span");
      s.className = "synth-spark";
      wrap.current.appendChild(s);
      const angle = -Math.PI / 2 + gsap.utils.random(-1.1, 1.1);
      const dist = gsap.utils.random(60, 180);
      gsap.fromTo(
        s,
        { x: r.left - host.left + r.width / 2, y: r.top - host.top + r.height * 0.3, scale: gsap.utils.random(0.6, 1.4), opacity: 1 },
        {
          x: `+=${Math.cos(angle) * dist}`,
          y: `+=${Math.sin(angle) * dist}`,
          opacity: 0,
          scale: 0,
          duration: gsap.utils.random(0.6, 1.2),
          ease: "power2.out",
          onComplete: () => s.remove(),
        }
      );
    }
  });

  return (
    <section ref={wrap} className="synth-section">
      <div className="synth-head">
        <p className="eyebrow">Brasa · 02 · Sonido con Web Audio API</p>
        <h2>Toca la brasa</h2>
        <p className="synth-hint">
          Haz clic en los pads o usa las teclas <kbd>A</kbd> a <kbd>J</kbd>.{" "}
          {!enabled && (
            <button type="button" className="btn btn-solid synth-enable" onClick={() => ensureAudio()}>
              Activar sonido
            </button>
          )}
        </p>
      </div>
      <canvas ref={canvas} className="synth-canvas" aria-hidden="true" />
      <div className="synth-pads">
        {NOTES.map((n, i) => (
          <button key={i} type="button" className="synth-pad" onPointerDown={() => trigger(i)} aria-label={`Nota ${n.name}`}>
            <span className="synth-glow" />
            <span className="synth-note">{n.name}</span>
            <kbd>{n.key.toUpperCase()}</kbd>
          </button>
        ))}
      </div>
    </section>
  );
}
