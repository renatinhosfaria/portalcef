import CatalogPageContent from './catalog-page-content';

export default function CatalogPage({
  params,
}: {
  params: Promise<{ schoolId: string; unitId: string }>;
}) {
  return <CatalogPageContent params={params} />;
}
