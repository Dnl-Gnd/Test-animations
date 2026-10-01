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
        title="Imagen convertida en partículas con física de resorte"
        summary="La pluma es un fotograma del render 3D original. Se lee en un <canvas> y cada píxel claro se convierte en una partícula; el brillo de ese píxel define qué tan cerca está de la cámara, así la imagen plana recupera relieve. Cada partícula tiene posición, velocidad y un resorte que la regresa a su sitio: el cursor la empuja y ella vuelve con rebote, igual que el cubo del video de referencia. Con el scroll la sección se fija y las partículas se esponjan, forman una esfera de pelusa y vuelven a armar la pluma."
        tools={[
          { name: "Canvas 2D: getImageData", role: "Lee los píxeles de la imagen para decidir dónde va cada partícula." },
          { name: "Three.js Points + BufferGeometry", role: "~30 000 puntos cuya posición se actualiza en cada frame." },
          { name: "Física en JavaScript", role: "Empuje del cursor, resorte y amortiguación por partícula." },
          { name: "Three.js Raycaster", role: "Lleva el mouse al plano de la pluma, aunque esté inclinada." },
          { name: "GLSL (vertex + fragment)", role: "Tamaño y color de cada punto; las partículas empujadas brillan." },
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
