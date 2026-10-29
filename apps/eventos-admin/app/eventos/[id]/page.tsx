import { EventReviewPage } from "@/features/eventos/event-review-page";

export default function EventoDetailPage({ params }: { params: { id: string } }) {
  return <EventReviewPage eventId={params.id} />;
}
