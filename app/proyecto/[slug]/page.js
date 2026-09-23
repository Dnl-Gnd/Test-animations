import { notFound } from "next/navigation";
import { PROJECTS, getProject } from "@/lib/projects";
import ProjectHero from "@/components/ProjectHero";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const project = getProject(slug);
  return { title: project ? `${project.title} · Test Animations` : "Proyecto" };
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = PROJECTS.indexOf(project);
  const next = PROJECTS[(index + 1) % PROJECTS.length];
  return <ProjectHero project={project} next={next} />;
}
