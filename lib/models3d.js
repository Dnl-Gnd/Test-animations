// Páginas internas de animaciones 3D (sección final del home).
// ready: false → la página existe pero la animación aún no está definida.
export const MODELS_3D = [
  { slug: "pluma", title: "Pluma", tag: "Sólido + partículas", ready: true, a: "#3a6bff", b: "#c9d8ff", text: "Un render 3D sólido que se abolla bajo el cursor y, con el scroll, se deshace en una esfera de partículas." },
  { slug: "planeta-logo", title: "Planeta → Logo", tag: "Morph + nébulas", ready: true, a: "#2944f2", b: "#9a4bff", text: "Un planeta que flota entre nébulas se derrite con el scroll y toma la forma del logo." },
  { slug: "globo-prestige", title: "Globo → Prestige", tag: "Globo + viaje", ready: true, a: "#2b1e8c", b: "#ff6a1a", text: "Una Tierra realista con un pin en Los Ángeles; con el scroll, la cámara viaja a toda velocidad hasta el taller en Google Maps." },
  { slug: "modelo-04", title: "Modelo 04", tag: "Por definir", ready: false, a: "#ff3d2e", b: "#ffd36b", text: "Animación 3D por definir." },
];

export const getModel3D = (slug) => MODELS_3D.find((m) => m.slug === slug);
