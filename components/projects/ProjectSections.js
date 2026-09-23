import AuroraSky from "@/components/projects/aurora/AuroraSky";
import VelocityMarquee from "@/components/projects/aurora/VelocityMarquee";
import Galaxy from "@/components/projects/nebula/Galaxy";
import WordReveal from "@/components/projects/nebula/WordReveal";
import ImageTrail from "@/components/projects/coral/ImageTrail";
import TiltCards from "@/components/projects/coral/TiltCards";
import DemoInfo from "@/components/DemoInfo";

/**
 * Secciones propias de cada página de proyecto, con su ficha técnica.
 */
const BASE = [
  { name: "Lenis", role: "Scroll suave, sincronizado con gsap.ticker." },
  { name: "PageTransition", role: "La transición de columnas con la que llegaste aquí." },
];

function Aurora() {
  return (
    <>
      <AuroraSky />
      <VelocityMarquee />
      <DemoInfo
        kicker="Aurora"
        title="Aurora boreal con shader + marquesina por velocidad"
        summary="El cielo es un único fragment shader: cuatro capas de ruido forman las cortinas, un ruido estirado en vertical dibuja los rayos, y las estrellas y montañas también son matemáticas. Debajo, tres marquesinas infinitas se aceleran, cambian de dirección y se inclinan según la velocidad del scroll."
        tools={[
          { name: "Three.js + ShaderMaterial", role: "Un plano a pantalla completa donde corre el shader del cielo." },
          { name: "GLSL: simplex noise", role: "Altura de las cortinas, rayos verticales y silueta de las montañas." },
          { name: "GLSL: hash por celda", role: "Estrellas repartidas en una cuadrícula, con parpadeo por seno." },
          { name: "GSAP quickTo", role: "Parallax horizontal de las cortinas con el mouse." },
          { name: "GSAP ScrollTrigger (scrub)", role: "Cambia la paleta de verde a rosa mientras la sección cruza la pantalla." },
          { name: "GSAP tween con repeat: -1", role: "Movimiento infinito de cada fila de la marquesina (-50% con contenido duplicado)." },
          { name: "ScrollTrigger.getVelocity()", role: "Ajusta timeScale (velocidad y dirección) y skewX de las marquesinas." },
          ...BASE,
        ]}
        file="components/projects/aurora/AuroraSky.js · VelocityMarquee.js"
      />
    </>
  );
}

function Nebula() {
  return (
    <>
      <Galaxy />
      <WordReveal />
      <DemoInfo
        kicker="Nébula"
        title="Galaxia de partículas + scroll narrativo"
        summary="60 000 partículas colocadas con una fórmula de espiral (radio, brazo y giro). El vertex shader aplica rotación diferencial, así el centro gira más rápido que los bordes. La sección se fija y el scroll mueve la cámara hasta el núcleo. Después, un párrafo se enciende palabra por palabra al ritmo del scroll."
        tools={[
          { name: "Three.js Points + BufferGeometry", role: "Las 60 000 estrellas con color y tamaño por partícula." },
          { name: "GLSL (vertex shader)", role: "Rotación diferencial: velocidad angular = 1 / distancia al centro." },
          { name: "AdditiveBlending", role: "Donde se juntan estrellas el brillo se suma y forma el núcleo." },
          { name: "GSAP timeline + ScrollTrigger (pin)", role: "Recorrido de la cámara en dos tramos y los tres textos." },
          { name: "GSAP quickTo", role: "Parallax suave de la cámara con el mouse." },
          { name: "GSAP SplitText", role: "Divide el párrafo en palabras." },
          { name: "ScrollTrigger (scrub + stagger)", role: "Enciende cada palabra y desenfoca/colorea las destacadas." },
          ...BASE,
        ]}
        file="components/projects/nebula/Galaxy.js · WordReveal.js"
      />
    </>
  );
}

function Coral() {
  return (
    <>
      <ImageTrail />
      <TiltCards />
      <DemoInfo
        kicker="Coral"
        title="Rastro de imágenes + tarjetas con inclinación 3D"
        summary="Sin WebGL: todo es DOM y CSS animado con GSAP. Un grupo fijo de imágenes se reutiliza para dejar un rastro detrás del cursor. Las tarjetas de producto se inclinan en 3D según dónde esté el mouse, con parallax interno, un brillo que sigue al puntero y un rebote elástico al salir."
        tools={[
          { name: "Pool de <img> + gsap.timeline", role: "Cada imagen aparece, sigue el movimiento y cae. Se reutilizan en orden." },
          { name: "gsap.utils.random", role: "Rotación aleatoria de cada imagen del rastro." },
          { name: "GSAP quickTo (rotationX / rotationY)", role: "Inclinación de la tarjeta según la posición del mouse." },
          { name: "transformPerspective", role: "Da profundidad real a la rotación 3D en CSS." },
          { name: "Variables CSS (--gx, --gy)", role: "Mueven el brillo radial para que siga al puntero." },
          { name: "ScrollTrigger.batch", role: "Anima las tarjetas en grupo cuando entran en pantalla." },
          { name: "GSAP elastic.out", role: "Rebote al soltar la tarjeta." },
          { name: "Canvas (lib/art.js)", role: "Genera las imágenes. En una tienda real serían fotos de producto." },
          ...BASE,
        ]}
        file="components/projects/coral/ImageTrail.js · TiltCards.js"
      />
    </>
  );
}

const SECTIONS = { aurora: Aurora, nebula: Nebula, coral: Coral };

export default function ProjectSections({ slug }) {
  const Sections = SECTIONS[slug];
  return Sections ? <Sections /> : null;
}
