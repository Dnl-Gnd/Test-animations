import { notFound } from "next/navigation";
import { MODELS_3D, getModel3D } from "@/lib/models3d";
import ProjectHero from "@/components/ProjectHero";
import Model3DSections from "@/components/models3d/Model3DSections";

export function generateStaticParams() {
  return MODELS_3D.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const model = getModel3D(slug);
  return { title: model ? `${model.title} · Animaciones 3D` : "Animación 3D" };
}

export default async function Model3DPage({ params }) {
  const { slug } = await params;
  const model = getModel3D(slug);
  if (!model) notFound();

  const index = MODELS_3D.indexOf(model);
  const next = MODELS_3D[(index + 1) % MODELS_3D.length];
  return (
    <ProjectHero project={model} next={next} eyebrow={`Animación 3D · ${model.tag}`} basePath="/3d">
      <Model3DSections model={model} />
    </ProjectHero>
  );
}
