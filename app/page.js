import ShaderBackground from "@/components/demos/ShaderBackground";
import ParticleMorph from "@/components/demos/ParticleMorph";
import WaveTerrain from "@/components/demos/WaveTerrain";
import CurvedGallery from "@/components/demos/CurvedGallery";
import TransitionsDemo from "@/components/demos/TransitionsDemo";
import DemoInfo from "@/components/DemoInfo";

const BASE = [
  { name: "Next.js + React", role: "Estructura de la página y componentes." },
  { name: "Lenis", role: "Scroll suave, sincronizado con gsap.ticker." },
];

export default function Home() {
  return (
    <main>
      <ShaderBackground />
      <DemoInfo
        number="01"
        title="Fondo fluido con shader"
        summary="Un solo rectángulo que cubre la pantalla. El fragment shader calcula el color de cada píxel con ruido fractal (fbm) y domain warping: el ruido deforma las coordenadas de otro ruido, y por eso se ve como humo o tinta. No hay ningún modelo 3D."
        tools={[
          { name: "Three.js", role: "Crea el canvas WebGL, el plano y el ShaderMaterial." },
          { name: "GLSL (fragment shader)", role: "Simplex noise + fbm + domain warping para el color." },
          { name: "GSAP quickTo", role: "Suaviza el mouse con inercia antes de pasarlo al shader." },
          { name: "GSAP ScrollTrigger", role: "Pasa el progreso del scroll (0 a 1) al shader para cambiar paleta y zoom." },
          { name: "GSAP", role: "Entrada del título con máscara (yPercent + stagger)." },
          ...BASE,
        ]}
        file="components/demos/ShaderBackground.js"
      />

      <ParticleMorph />
      <DemoInfo
        number="02"
        title="Partículas que cambian de forma"
        summary="Cada partícula guarda dos posiciones calculadas con fórmulas: una sobre una esfera (Fibonacci) y otra sobre una doble hélice (ecuación paramétrica, como en Trionn). El vertex shader las mezcla según el scroll mientras la sección está fijada."
        tools={[
          { name: "Three.js Points + BufferGeometry", role: "18 000 puntos con atributos propios (aSphere, aHelix, aRandom)." },
          { name: "GLSL (vertex shader)", role: "Mezcla de formas, ruido para que respire, repulsión del mouse." },
          { name: "GSAP ScrollTrigger (pin + scrub)", role: "Fija la sección y convierte el scroll en el valor uMorph." },
          { name: "GSAP timeline", role: "Coordina forma, cámara y textos en una sola línea de tiempo." },
          { name: "Three.js Raycaster", role: "Convierte la posición del mouse en un punto del espacio 3D." },
          { name: "AdditiveBlending", role: "Los puntos que se superponen brillan más." },
          ...BASE,
        ]}
        file="components/demos/ParticleMorph.js"
      />

      <WaveTerrain />
      <DemoInfo
        number="03"
        title="Terreno de ondas en wireframe"
        summary="Un plano de 200 × 200 subdivisiones. El vertex shader sube y baja cada vértice con dos capas de ruido que avanzan con el tiempo, y el fragment shader agrega niebla según la distancia. Al hacer clic, GSAP anima una onda expansiva desde ese punto."
        tools={[
          { name: "Three.js PlaneGeometry", role: "La malla base (plana) que se deforma." },
          { name: "GLSL (vertex shader)", role: "Altura con simplex noise + onda del clic." },
          { name: "GLSL (fragment shader)", role: "Color según la altura y niebla por profundidad." },
          { name: "GSAP quickTo", role: "Parallax de cámara con el mouse." },
          { name: "GSAP fromTo", role: "Anima el progreso de la onda expansiva (uPulse)." },
          { name: "Three.js Raycaster", role: "Detecta en qué punto de la malla hiciste clic." },
          ...BASE,
        ]}
        file="components/demos/WaveTerrain.js"
      />

      <CurvedGallery />
      <DemoInfo
        number="04"
        title="Imágenes que se curvan con el scroll"
        summary="Las imágenes no son etiquetas <img>: son planos de Three.js con la imagen como textura, así el vertex shader puede doblarlas. Se curvan como un cilindro según su posición y se arquean como tela según la velocidad del scroll. Es la misma técnica de las tarjetas de Trionn."
        tools={[
          { name: "Three.js PlaneGeometry (32 × 32)", role: "Planos con subdivisiones suficientes para poder doblarse." },
          { name: "GLSL (vertex shader)", role: "Curva de cilindro, flexión por velocidad y abombado en hover." },
          { name: "GLSL (fragment shader)", role: "Esquinas redondeadas con SDF, separación RGB y paso de gris a color." },
          { name: "GSAP ScrollTrigger (pin + scrub)", role: "Convierte el scroll vertical en movimiento horizontal de la galería." },
          { name: "Three.js Raycaster + gsap.to", role: "Detecta la tarjeta bajo el mouse y anima su uHover." },
          { name: "CanvasTexture", role: "Genera las imágenes con <canvas>. En un proyecto real usarías TextureLoader con tus fotos." },
          ...BASE,
        ]}
        file="components/demos/CurvedGallery.js"
      />

      <TransitionsDemo />
      <DemoInfo
        number="05"
        title="Transiciones, cursor y botones magnéticos"
        summary="Al abrir un proyecto, cinco columnas cubren la pantalla, Next.js cambia de ruta y las columnas se retiran. El cursor es un punto y un anillo que siguen al mouse con distinta inercia, y crece o muestra texto según el elemento. Los botones magnéticos se desplazan hacia el puntero y regresan con un rebote elástico."
        tools={[
          { name: "GSAP timeline", role: "Salida y entrada de las columnas de la transición." },
          { name: "Next.js useRouter + usePathname", role: "Navega cuando la pantalla está cubierta y detecta cuándo cargó la página nueva." },
          { name: "React Context", role: "Comparte la función navigate() con todos los <TransitionLink>." },
          { name: "GSAP quickTo", role: "Cursor (punto rápido, anillo lento) y desplazamiento de los botones magnéticos." },
          { name: "GSAP elastic.out", role: "Rebote del botón al soltarlo." },
          { name: "GSAP SplitText", role: "Divide el título del proyecto en letras y las anima desde una máscara." },
          { name: "CustomEvent", role: "Permite que WebGL (demo 04) cambie el texto del cursor." },
          ...BASE,
        ]}
        file="components/PageTransition.js · Cursor.js · Magnetic.js"
      />

      <footer className="footer">
        <p>Todo lo que ves está hecho con código: no se usó ningún modelo de Blender ni archivo de imagen.</p>
      </footer>
    </main>
  );
}
