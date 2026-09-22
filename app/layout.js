import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

export const metadata = {
  title: "Test Animations · Fondos 3D procedurales",
  description: "Laboratorio de animaciones 3D procedurales con Three.js, GSAP y Lenis.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
