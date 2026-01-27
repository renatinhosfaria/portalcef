import { redirect } from "next/navigation";

/**
 * Redirect para a nova página de gestão de períodos
 * A funcionalidade de configuração de prazos foi movida para /gestao/periodos
 * que agora usa o sistema de períodos configuráveis dinâmicos
 */
export default function PrazosPage() {
  redirect("/gestao/periodos");
}
