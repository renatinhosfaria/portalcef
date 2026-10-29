import { EventReviewPage } from "@/features/eventos/event-review-page";

export default async function EventoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventReviewPage eventId={id} />;
}
