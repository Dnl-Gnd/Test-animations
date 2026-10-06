import PlumaParticles from "@/components/models3d/PlumaParticles";
import LogoPlaneta from "@/components/models3d/LogoPlaneta";
import GlobePrestige from "@/components/models3d/GlobePrestige";
import DemoInfo from "@/components/DemoInfo";

/**
 * Contenido de cada página de animación 3D, con su ficha técnica.
 * Las páginas sin animación (ready: false) muestran un aviso de "por definir".
 */
function Pluma() {
  return (
    <>
      <PlumaParticles />
      <DemoInfo
        kicker="Pluma"
        title="Pluma sólida que se deshace en partículas"
        summary="La pluma es un fotograma del render 3D original. Se usa como textura de una malla de 161 × 161 vértices; el brillo de la imagen (desenfocada) sube o baja cada vértice, así la imagen plana recupera relieve, y el fondo negro se recorta en el shader. Cada vértice tiene posición, velocidad y un resorte que lo regresa a su sitio: el cursor hunde levemente la superficie y, al alejarse, vuelve con rebote. Con el scroll la sección se fija, la superficie se desvanece en ~30 000 partículas que se esponjan, forman una esfera y vuelven a armar la pluma, que recupera su forma sólida."
        tools={[
          { name: "Canvas 2D: getImageData", role: "Lee los píxeles para el relieve de la malla y para ubicar cada partícula." },
          { name: "Three.js PlaneGeometry + textura", role: "La pluma sólida: 26 000 vértices con la imagen encima y el fondo recortado." },
          { name: "Three.js Points + BufferGeometry", role: "~30 000 puntos cuya posición se actualiza en cada frame." },
          { name: "Física en JavaScript", role: "Empuje del cursor, resorte y amortiguación por vértice y por partícula." },
          { name: "Three.js Raycaster", role: "Lleva el mouse al plano de la pluma, aunque esté inclinada." },
          { name: "GLSL (vertex + fragment)", role: "Recorte del fondo, brillo donde se abolla y fundido entre sólido y partículas." },
          { name: "GSAP quickTo", role: "Inclinación suave de la pluma siguiendo al mouse." },
          { name: "GSAP ScrollTrigger (pin + scrub)", role: "Fija la sección y convierte el scroll en pluma → esfera → pluma, con los textos." },
        ]}
        file="components/models3d/PlumaParticles.js · public/3d/pluma.png"
      />
    </>
  );
}

function PlanetaLogo() {
  return (
    <>
      <LogoPlaneta />
      <DemoInfo
        kicker="Planeta → Logo"
        title="Un planeta que se derrite y se vuelve el logo"
        summary="El modelo sale de Blender (blender/logo_planeta.py): el logo se arma con su silueta extruida y redondeada, se remalla para que los vértices queden parejos y se le agrega un shape key que infla esa misma malla hasta formar una esfera con relieve. Exportado a glTF, el shape key llega a three.js como un morph target, así el cambio es una sola malla que se deforma. El material del logo se extiende en el shader para pintar océanos, continentes y nubes, y a mitad del cambio la superficie ondula con ruido como si fuera líquida. Una esfera lisa cubre el planeta al inicio y se disuelve cuando empieza el morph. El fondo es un shader de pantalla completa con nébulas y estrellas que titilan."
        tools={[
          { name: "Blender (Python, bpy)", role: "Silueta → curva extruida → remallado → shape key \"Planeta\" → exportación a GLB." },
          { name: "Three.js GLTFLoader + morph targets", role: "Carga el GLB; morphTargetInfluences[0] lleva del planeta (1) al logo (0)." },
          { name: "MeshPhysicalMaterial + onBeforeCompile", role: "Barniz del logo, color del planeta, brillo de atmósfera y ondas líquidas." },
          { name: "GLSL: simplex noise + fbm", role: "Continentes, nubes, disolución del cascarón y nébulas con domain warping." },
          { name: "RoomEnvironment + PMREMGenerator", role: "Reflejos de estudio en el barniz azul." },
          { name: "GSAP ScrollTrigger (pin + scrub)", role: "Fija la sección y convierte el scroll en planeta → logo, con los textos." },
          { name: "GSAP quickTo", role: "Inclinación suave siguiendo al mouse." },
        ]}
        file="components/models3d/LogoPlaneta.js · blender/logo_planeta.py · public/3d/logo-planeta.glb"
      />
    </>
  );
}

function GloboPrestige() {
  return (
    <>
      <GlobePrestige />
      <DemoInfo
        kicker="Globo → Prestige"
        title="Del globo terráqueo al taller, a toda velocidad"
        summary="La Tierra es una esfera con un shader propio que mezcla cinco texturas de la NASA: el día (Blue Marble), las luces de ciudades en el lado nocturno (Black Marble), una máscara de agua para el reflejo del sol, el relieve y las nubes, que además proyectan sombra. Las nubes son una segunda esfera apenas más grande y la atmósfera es una tercera con brillo en el borde. El pin es HTML: en cada frame se proyecta la latitud y longitud del taller a la pantalla. Al hacer clic, una timeline gira el globo hasta dejar Whittier de frente y lanza la cámara al suelo acelerando (atraviesa las nubes); un post-procesado aplica desenfoque radial y el mapa de Google aparece desde ese mismo desenfoque. Volver reproduce la timeline al revés."
        tools={[
          { name: "Three.js ShaderMaterial", role: "Día/noche, luces de ciudades, reflejo en el agua, relieve, sombra de nubes y atmósfera." },
          { name: "Texturas NASA (Blue Marble, Black Marble)", role: "Imágenes de dominio público en public/3d/earth." },
          { name: "WebGLRenderTarget + shader de post-procesado", role: "Desenfoque radial que simula la velocidad del viaje." },
          { name: "Vector3.project", role: "Coloca el pin HTML sobre Whittier y lo oculta cuando queda detrás del globo." },
          { name: "GSAP timeline (play / reverse)", role: "Giro, caída de la cámara con expo.in, aparición del mapa y regreso." },
          { name: "Google Maps embed", role: "Mapa interactivo del taller; el iframe se carga durante el vuelo." },
          { name: "@fontsource (Roboto Mono, Michroma)", role: "Tipografías del diseño servidas desde el propio sitio." },
        ]}
        file="components/models3d/GlobePrestige.js · public/3d/earth/"
      />
    </>
  );
}

const SECTIONS = { pluma: Pluma, "planeta-logo": PlanetaLogo, "globo-prestige": GloboPrestige };

export default function Model3DSections({ model }) {
  const Sections = SECTIONS[model.slug];
  if (Sections) return <Sections />;

  return (
    <section className="model-pending">
      <p className="eyebrow">Próximamente</p>
      <h2>Esta animación 3D todavía está por definir.</h2>
    </section>
  );
}
