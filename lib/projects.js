// Datos de ejemplo para las páginas de la demo de transiciones
export const PROJECTS = [
  { slug: "aurora", title: "Aurora", year: "2026", a: "#6d4bff", b: "#ff7a59", text: "Identidad visual con fondos generativos en WebGL." },
  { slug: "nebula", title: "Nébula", year: "2025", a: "#1b3cff", b: "#7cffd4", text: "Sitio inmersivo con partículas y scroll narrativo." },
  { slug: "coral", title: "Coral", year: "2025", a: "#ff4f7b", b: "#ffd36b", text: "Tienda en línea con galerías que reaccionan al movimiento." },
  { slug: "marea", title: "Marea", year: "2025", a: "#0f7c8c", b: "#b6f0ff", text: "Campaña para una marca de trajes de baño, con agua que responde al cursor." },
  { slug: "ambar", title: "Ámbar", year: "2024", a: "#ff8a1f", b: "#3a0f5c", text: "Historia de marca contada con materiales translúcidos y una línea de tiempo." },
  { slug: "glaciar", title: "Glaciar", year: "2024", a: "#c9d8ff", b: "#3056ff", text: "Archivo interactivo de glaciares con vistas que se reorganizan." },
  { slug: "brasa", title: "Brasa", year: "2023", a: "#ff3d2e", b: "#1a0b2e", text: "Experiencia sonora para un restaurante de cocina a la leña." },
];

export const getProject = (slug) => PROJECTS.find((p) => p.slug === slug);
