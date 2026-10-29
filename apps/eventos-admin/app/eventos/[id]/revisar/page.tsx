import { EventReviewPage } from "@/features/eventos/event-review-page";

export default function RevisarPage({ params }: { params: { id: string } }) {
  return <EventReviewPage eventId={params.id} />;
}
