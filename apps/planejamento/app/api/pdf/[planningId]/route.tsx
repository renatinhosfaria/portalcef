/**
 * PDF Generation API Route
 * Gera PDF do planejamento usando @react-pdf/renderer
 * Epic 3 - Story 3.4: Geração Automática de PDF
 */

import { ServerFetchError, serverApi } from "@essencia/shared/fetchers/server";
import { renderToStream } from "@react-pdf/renderer";
import { type NextRequest, NextResponse } from "next/server";

import { PlanningPdfTemplate } from "../../../../features/pdf-templates/planning-pdf-template";

// Tipo para os dados recebidos via params
interface PdfParams {
  planningId: string;
}

interface PlanningDetails {
  professorName?: string;
  turma: string;
  quinzena: string;
  objetivos?: string | null;
  metodologia?: string | null;
  recursos?: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<PdfParams> },
) {
  try {
    const { planningId } = await params;

    const cookieHeader = request.headers.get("cookie") ?? undefined;
    const planning = await serverApi.get<PlanningDetails>(
      `/plannings/${planningId}`,
      cookieHeader ? { cookies: cookieHeader } : undefined,
    );

    // Extrair dados do planejamento
    const turma = planning.turma || "Turma não especificada";
    const quinzena = planning.quinzena || "Quinzena não especificada";
    const objetivos = planning.objetivos || undefined;
    const metodologia = planning.metodologia || undefined;
    const recursosText = planning.recursos || "";
    const recursos = recursosText ? recursosText.split("\n") : undefined;
    const professorName = planning.professorName || undefined;

    // Gerar o PDF
    const pdfStream = await renderToStream(
      <PlanningPdfTemplate
        data={{
          turma,
          quinzena,
          objetivos,
          metodologia,
          recursos,
          professorName,
        }}
      />,
    );

    // Converter ReadableStream para Response
    const response = new NextResponse(pdfStream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="planejamento_${turma}_${quinzena}.pdf"`,
        "Cache-Control": "no-store", // Não cachear pois o planejamento pode mudar
      },
    });

    return response;
  } catch (error) {
    console.error("PDF Generation Error:", error);
    if (error instanceof ServerFetchError) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Planejamento não encontrado" },
          { status: 404 },
        );
      }
      if (error.status === 401) {
        return NextResponse.json(
          { error: "Usuário não autenticado" },
          { status: 401 },
        );
      }
      if (error.status === 403) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Erro ao gerar PDF" }, { status: 500 });
  }
}
