import { EventReviewPage } from "@/features/eventos/event-review-page";

export default async function RevisarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventReviewPage eventId={id} />;
}
