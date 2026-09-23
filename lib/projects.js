// Datos de ejemplo para las páginas de la demo de transiciones
export const PROJECTS = [
  { slug: "aurora", title: "Aurora", year: "2026", a: "#6d4bff", b: "#ff7a59", text: "Identidad visual con fondos generativos en WebGL." },
  { slug: "nebula", title: "Nébula", year: "2025", a: "#1b3cff", b: "#7cffd4", text: "Sitio inmersivo con partículas y scroll narrativo." },
  { slug: "coral", title: "Coral", year: "2025", a: "#ff4f7b", b: "#ffd36b", text: "Tienda en línea con galerías que reaccionan al movimiento." },
];

export const getProject = (slug) => PROJECTS.find((p) => p.slug === slug);
