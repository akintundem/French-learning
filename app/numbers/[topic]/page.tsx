import { notFound } from "next/navigation";
import PracticalDrill from "@/app/components/PracticalDrill";
import { TOPICS, TOPIC_IDS } from "@/lib/practical";

export function generateStaticParams() {
  return [{ topic: "all" }, ...TOPICS.map((t) => ({ topic: t.id }))];
}

export default async function NumbersPractice({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;

  if (topic === "all")
    return (
      <PracticalDrill title="Numbers & dates · everything" topicIds={TOPIC_IDS} />
    );

  const found = TOPICS.find((t) => t.id === topic);
  if (!found) notFound();

  return <PracticalDrill title={found.title} topicIds={[found.id]} />;
}
