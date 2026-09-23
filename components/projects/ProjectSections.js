import AuroraSky from "@/components/projects/aurora/AuroraSky";
import VelocityMarquee from "@/components/projects/aurora/VelocityMarquee";
import Galaxy from "@/components/projects/nebula/Galaxy";
import WordReveal from "@/components/projects/nebula/WordReveal";
import ImageTrail from "@/components/projects/coral/ImageTrail";
import TiltCards from "@/components/projects/coral/TiltCards";
import WaterRipples from "@/components/projects/marea/WaterRipples";
import LiquidSlideshow from "@/components/projects/marea/LiquidSlideshow";
import ResinBlob from "@/components/projects/ambar/ResinBlob";
import DrawTimeline from "@/components/projects/ambar/DrawTimeline";
import IceShatter from "@/components/projects/glaciar/IceShatter";
import FlipGrid from "@/components/projects/glaciar/FlipGrid";
import FireEmbers from "@/components/projects/brasa/FireEmbers";
import EmberSynth from "@/components/projects/brasa/EmberSynth";
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

function Marea() {
  return (
    <>
      <WaterRipples />
      <LiquidSlideshow />
      <DemoInfo
        kicker="Marea"
        title="Agua simulada en la GPU + transición líquida"
        summary="La altura del agua se guarda en una textura y un shader la recalcula en cada frame con la ecuación de onda, alternando dos render targets (ping-pong). Otro shader usa esa altura para refractar el fondo y dibujar reflejos. Después, una sección fijada recorre cuatro imágenes con el scroll: un ruido las arrastra como agua mientras una se funde en la otra."
        tools={[
          { name: "THREE.WebGLRenderTarget (HalfFloat)", role: "Dos texturas donde vive la simulación; se alternan en cada paso." },
          { name: "GLSL: ecuación de onda", role: "Altura nueva = promedio de vecinos − altura anterior, con amortiguación." },
          { name: "GLSL: normales y refracción", role: "La inclinación del agua desplaza el fondo y genera el brillo especular." },
          { name: "Gotas aleatorias + mouse", role: "Impulsos que se suman a la simulación según la velocidad del puntero." },
          { name: "GLSL: transición con ruido", role: "Mezcla dos texturas con un borde ondulado y desplazamiento opuesto." },
          { name: "ScrollTrigger (pin + scrub + snap)", role: "El scroll elige la imagen y el progreso; al soltar, se ajusta a la más cercana." },
          { name: "Cálculo tipo object-fit: cover", role: "Ajusta las coordenadas para que las imágenes no se deformen en ninguna pantalla." },
          ...BASE,
        ]}
        file="components/projects/marea/WaterRipples.js · LiquidSlideshow.js"
      />
    </>
  );
}

function Ambar() {
  return (
    <>
      <ResinBlob />
      <DrawTimeline />
      <DemoInfo
        kicker="Ámbar"
        title="Resina con refracción + línea de tiempo con DrawSVG"
        summary="La gota usa el material físico de Three.js en modo transmisión, como vidrio o resina: refracta el texto que tiene detrás y separa los colores. Su forma se deforma con ruido inyectado en el shader del propio material (onBeforeCompile), recalculando las normales para que la luz siga la forma. Debajo, una línea SVG se dibuja con el scroll y un punto la recorre mientras aparecen los hitos."
        tools={[
          { name: "MeshPhysicalMaterial (transmission, ior, dispersion)", role: "Material de resina translúcida que refracta y separa colores." },
          { name: "onBeforeCompile", role: "Inyecta el ruido de deformación en el shader de Three.js sin reescribir el material." },
          { name: "RoomEnvironment + PMREMGenerator", role: "Entorno virtual para los reflejos, sin archivos HDRI." },
          { name: "GSAP quickTo + timeline con scrub", role: "Giro con el mouse y cambio de tamaño, forma y color con el scroll." },
          { name: "GSAP DrawSVGPlugin", role: "Dibuja el trazo de 0% a 100% según el scroll." },
          { name: "GSAP MotionPathPlugin", role: "Mueve el punto brillante sobre el mismo camino." },
          { name: "Camino SVG calculado en JS", role: "Se recalcula al cambiar el tamaño para pasar siempre por los hitos." },
          { name: "Contadores con GSAP", role: "Cada número cuenta desde 0 cuando su hito entra en pantalla." },
          ...BASE,
        ]}
        file="components/projects/ambar/ResinBlob.js · DrawTimeline.js"
      />
    </>
  );
}

function Glaciar() {
  return (
    <>
      <IceShatter />
      <FlipGrid />
      <DemoInfo
        kicker="Glaciar"
        title="Hielo que se fragmenta + tarjetas que se reorganizan con Flip"
        summary="El bloque de hielo es una geometría no indexada: cada triángulo guarda su centro, un eje y un número aleatorio. El vertex shader separa, gira y deja caer cada fragmento según el scroll, y luego los vuelve a unir. Debajo, tarjetas de vidrio esmerilado cambian entre cuadrícula y lista o se filtran, y GSAP Flip anima cada una desde su posición anterior."
        tools={[
          { name: "BufferGeometry.toNonIndexed()", role: "Separa los triángulos para poder moverlos de forma independiente." },
          { name: "Atributos por cara (aCenter, aAxis, aRandom)", role: "Datos que el shader usa para mover cada fragmento." },
          { name: "GLSL: rotación de Rodrigues", role: "Gira cada fragmento alrededor de su propio eje." },
          { name: "GLSL: dFdx / dFdy", role: "Calcula la normal de cada cara en el fragment shader para el aspecto facetado." },
          { name: "ScrollTrigger (pin + scrub)", role: "Rompe el hielo, lo vuelve a unir y cambia los textos." },
          { name: "GSAP Flip", role: "Anima el cambio de cuadrícula a lista y los filtros (onEnter / onLeave)." },
          { name: "CSS backdrop-filter", role: "Efecto de vidrio esmerilado sobre manchas de color animadas." },
          ...BASE,
        ]}
        file="components/projects/glaciar/IceShatter.js · FlipGrid.js"
      />
    </>
  );
}

function Brasa() {
  return (
    <>
      <FireEmbers />
      <EmberSynth />
      <DemoInfo
        kicker="Brasa"
        title="Fuego con shaders + sonido interactivo con Web Audio"
        summary="El fuego es un fragment shader con ruido fractal que sube y se pinta con una rampa de color; el mouse funciona como fuente de calor. Las chispas son puntos cuya trayectoria se calcula entera en el vertex shader. Debajo, siete pads generan notas en tiempo real con Web Audio (sin archivos de sonido), un visualizador las dibuja como columnas de fuego y cada nota lanza chispas."
        tools={[
          { name: "GLSL: fbm + rampa de color", role: "Forma y color de las llamas, inclinadas hacia el mouse." },
          { name: "THREE.Points (vertex shader)", role: "1 400 chispas en bucle, empujadas por el mouse como viento." },
          { name: "ScrollTrigger (scrub)", role: "Aviva el fuego mientras la sección cruza la pantalla." },
          { name: "Web Audio: OscillatorNode × 3", role: "Cada nota son tres osciladores desafinados, como en Trionn." },
          { name: "Web Audio: GainNode + DelayNode", role: "Envolvente de volumen y eco con retroalimentación." },
          { name: "Web Audio: AnalyserNode", role: "Lee las frecuencias para el visualizador." },
          { name: "Canvas 2D + gsap.ticker", role: "Dibuja las columnas de fuego en cada frame." },
          { name: "GSAP (elastic + chispas DOM)", role: "Rebote de los pads y chispas que salen de cada nota." },
          ...BASE,
        ]}
        file="components/projects/brasa/FireEmbers.js · EmberSynth.js"
      />
    </>
  );
}

const SECTIONS = { aurora: Aurora, nebula: Nebula, coral: Coral, marea: Marea, ambar: Ambar, glaciar: Glaciar, brasa: Brasa };

export default function ProjectSections({ slug }) {
  const Sections = SECTIONS[slug];
  return Sections ? <Sections /> : null;
}
