# Test Animations: laboratorio de animaciones web

Laboratorio para probar animaciones estilo Awwwards (como trionn.com) sin modelos de Blender ni archivos de imagen: todo se genera con código.

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
| GSAP SplitText | Divide textos en letras para animarlas |
| @gsap/react (`useGSAP`) | Limpia automáticamente las animaciones cuando el componente se desmonta |
| Lenis | Scroll suave, sincronizado con `gsap.ticker` |

## Demos

| # | Demo | Archivo | Técnica principal |
|---|---|---|---|
| 01 | Fondo fluido | `components/demos/ShaderBackground.js` | Fragment shader con fbm + domain warping |
| 02 | Partículas esfera → hélice | `components/demos/ParticleMorph.js` | `THREE.Points` + vertex shader + ScrollTrigger (pin + scrub) |
| 03 | Terreno de ondas | `components/demos/WaveTerrain.js` | Vertex shader con ruido + wireframe + onda al hacer clic |
| 04 | Imágenes que se curvan | `components/demos/CurvedGallery.js` | Planos con textura + vertex shader (cilindro y flexión por velocidad) + ScrollTrigger horizontal |
| 05 | Transiciones y cursor | `components/PageTransition.js`, `Cursor.js`, `Magnetic.js` | GSAP timeline + App Router, cursor con quickTo, botones magnéticos con elastic.out |

## Estructura

```
app/
  layout.js            Layout con scroll suave (Lenis)
  page.js              Página con las 5 demos y sus fichas técnicas
  proyecto/[slug]/     Páginas de destino para probar las transiciones
  globals.css
components/
  SmoothScroll.js      Lenis + gsap.ticker + ScrollTrigger
  DemoInfo.js          Ficha "cómo está hecho" de cada demo
  Cursor.js            Cursor personalizado (usa data-cursor-label="Texto" o setCursor())
  Magnetic.js          Envoltorio para botones magnéticos
  PageTransition.js    Provider + <TransitionLink> para transiciones entre páginas
  ProjectHero.js       Página de proyecto con título animado (SplitText)
  demos/               Una demo por archivo
lib/
  createStage.js       Renderer + resize + loop compartido (se pausa fuera de pantalla)
  glsl/noise.js        Simplex noise 3D (MIT) usado por todos los shaders
  projects.js          Datos de ejemplo de los proyectos
```

## Cómo agregar una demo nueva

1. Crea `components/demos/MiDemo.js` copiando la estructura de una existente.
2. Usa `createStage(contenedor, { camera })` para no repetir el setup de Three.js.
3. Agrégala en `app/page.js` con su `<DemoInfo />`.

## Cómo usar las piezas de la demo 05 en otro proyecto

```jsx
// Texto en el cursor
<div data-cursor-label="Ver">...</div>

// Botón magnético
<Magnetic><button className="btn">Contacto</button></Magnetic>

// Enlace con transición (dentro de <PageTransitionProvider>)
<TransitionLink href="/proyecto/aurora" label="Aurora">Aurora</TransitionLink>
```

Para usar fotos reales en la demo 04, cambia `makeTexture()` por `new THREE.TextureLoader().load("/fotos/1.jpg")`.

## Buenas prácticas incluidas

- El render solo corre cuando el canvas es visible (`IntersectionObserver`).
- Todo usa el mismo reloj (`gsap.ticker`), así Lenis, GSAP y Three.js no se desfasan.
- Respeta `prefers-reduced-motion`.
- El cursor y los botones magnéticos se desactivan en pantallas táctiles.
- `pixelRatio` limitado para no saturar la GPU en pantallas retina.
