import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Cursor from "@/components/Cursor";
import { PageTransitionProvider } from "@/components/PageTransition";

export const metadata = {
  title: "Test Animations · Laboratorio de animaciones",
  description: "Laboratorio de animaciones web con Three.js, GSAP y Lenis.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <SmoothScroll>
          <PageTransitionProvider>{children}</PageTransitionProvider>
        </SmoothScroll>
        <Cursor />
      </body>
    </html>
  );
}
