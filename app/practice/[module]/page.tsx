import { notFound } from "next/navigation";
import Quiz from "@/app/components/Quiz";
import { MODULES } from "@/lib/vocab";

const QUICK_COUNT = 20;

export function generateStaticParams() {
  return [
    { module: "all" },
    { module: "random" },
    ...MODULES.map((m) => ({ module: m.id })),
  ];
}

export default async function Practice({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: id } = await params;
  const all = MODULES.flatMap((m) => m.words);

  if (id === "all") return <Quiz title="Everything · A2–B1" words={all} scope="all" />;

  // Sampling happens in the client via `limit`; picking here would bake one
  // fixed set into the prerendered page.
  if (id === "random")
    return <Quiz
        title={`Quick ${QUICK_COUNT}`}
        words={all}
        limit={QUICK_COUNT}
        scope="random"
      />;

  const mod = MODULES.find((m) => m.id === id.toUpperCase());
  if (!mod) notFound();

  return (
    <Quiz title={`${mod.id} · ${mod.title}`} words={mod.words} scope={mod.id} />
  );
}
