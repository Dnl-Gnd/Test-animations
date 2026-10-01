// Páginas internas de animaciones 3D (sección final del home).
// ready: false → la página existe pero la animación aún no está definida.
export const MODELS_3D = [
  { slug: "pluma", title: "Pluma", tag: "Partículas", ready: true, a: "#3a6bff", b: "#c9d8ff", text: "Un render 3D convertido en 30 000 partículas que se apartan del cursor y vuelven con rebote." },
  { slug: "modelo-02", title: "Modelo 02", tag: "Por definir", ready: false, a: "#7a4bff", b: "#ff8a5c", text: "Animación 3D por definir." },
  { slug: "modelo-03", title: "Modelo 03", tag: "Por definir", ready: false, a: "#0f7c8c", b: "#7cffd4", text: "Animación 3D por definir." },
  { slug: "modelo-04", title: "Modelo 04", tag: "Por definir", ready: false, a: "#ff3d2e", b: "#ffd36b", text: "Animación 3D por definir." },
];

export const getModel3D = (slug) => MODELS_3D.find((m) => m.slug === slug);
