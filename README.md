# Test Animations: fondos 3D procedurales

Laboratorio para probar animaciones 3D estilo Awwwards (como trionn.com) sin modelos de Blender: todo se genera con código.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Stack

| Herramienta | Para qué se usa |
|---|---|
| Next.js + React | Estructura de la página y componentes |
| Three.js | Canvas WebGL, cámaras, geometrías y materiales |
| GLSL (shaders) | Calcular posición y color en la GPU (ruido, deformaciones, niebla) |
| GSAP + ScrollTrigger | Animaciones, suavizado del mouse y animaciones controladas por scroll |
| @gsap/react (`useGSAP`) | Limpia automáticamente las animaciones cuando el componente se desmonta |
| Lenis | Scroll suave, sincronizado con `gsap.ticker` |

## Demos

| # | Demo | Archivo | Técnica principal |
|---|---|---|---|
| 01 | Fondo fluido | `components/demos/ShaderBackground.js` | Fragment shader con fbm + domain warping |
| 02 | Partículas esfera → hélice | `components/demos/ParticleMorph.js` | `THREE.Points` + vertex shader + ScrollTrigger (pin + scrub) |
| 03 | Terreno de ondas | `components/demos/WaveTerrain.js` | Vertex shader con ruido + wireframe + onda al hacer clic |

## Estructura

```
app/
  layout.js            Layout con scroll suave (Lenis)
  page.js              Página con las 3 demos y sus fichas técnicas
  globals.css
components/
  SmoothScroll.js      Lenis + gsap.ticker + ScrollTrigger
  DemoInfo.js          Ficha "cómo está hecho" de cada demo
  demos/               Una demo por archivo
lib/
  createStage.js       Renderer + resize + loop compartido (se pausa fuera de pantalla)
  glsl/noise.js        Simplex noise 3D (MIT) usado por todos los shaders
```

## Cómo agregar una demo nueva

1. Crea `components/demos/MiDemo.js` copiando la estructura de una existente.
2. Usa `createStage(contenedor, { camera })` para no repetir el setup de Three.js.
3. Agrégala en `app/page.js` con su `<DemoInfo />`.

## Buenas prácticas incluidas

- El render solo corre cuando el canvas es visible (`IntersectionObserver`).
- Todo usa el mismo reloj (`gsap.ticker`), así Lenis, GSAP y Three.js no se desfasan.
- Respeta `prefers-reduced-motion`.
- `pixelRatio` limitado para no saturar la GPU en pantallas retina.
