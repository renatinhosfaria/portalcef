import CatalogPageContent from '../catalog-page-content';

export default function PreVendaCatalogPage({
  params,
}: {
  params: Promise<{ schoolId: string; unitId: string }>;
}) {
  return (
    <CatalogPageContent
      params={params}
      initialCategoryFilter="PRE_VENDA"
      canonicalSuffix="/pre-venda"
    />
  );
}
