import { notFound } from "next/navigation";
import PracticalDrill from "@/app/components/PracticalDrill";
import { GRAMMAR_IDS, GRAMMAR_TOPICS } from "@/lib/grammar";

export function generateStaticParams() {
  return [{ topic: "all" }, ...GRAMMAR_TOPICS.map((t) => ({ topic: t.id }))];
}

export default async function GrammarPractice({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;

  if (topic === "all")
    return (
      <PracticalDrill
        title="Grammar · everything"
        topicIds={GRAMMAR_IDS}
        set="grammar"
      />
    );

  const found = GRAMMAR_TOPICS.find((t) => t.id === topic);
  if (!found) notFound();

  return (
    <PracticalDrill title={found.title} topicIds={[found.id]} set="grammar" />
  );
}
