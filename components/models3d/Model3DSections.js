import PlumaParticles from "@/components/models3d/PlumaParticles";
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

const SECTIONS = { pluma: Pluma };

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
