export type ResumoRelatorioCsp = {
  documentUri: string;
  violatedDirective: string;
  blockedUri?: string | null;
};

type CspReportBody = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "blocked-uri"?: string;
  };
};

export function extrairResumoRelatorioCsp(
  body: unknown,
): ResumoRelatorioCsp | null {
  if (!body || typeof body !== "object") return null;

  const report = (body as CspReportBody)["csp-report"];
  if (!report) return null;

  const documentUri = report["document-uri"];
  const violatedDirective = report["violated-directive"];

  if (!documentUri || !violatedDirective) return null;

  return {
    documentUri,
    violatedDirective,
    blockedUri: report["blocked-uri"] ?? null,
  };
}
