"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useEventoAutosave } from "@/features/eventos/use-evento-autosave";
import { assertRespostaApi, construirPayloadInformacoes, slugSugerido, type InformacoesValue } from "@/features/eventos/etapas-contratos";

const vazio: InformacoesValue = { title: "", slug: "", summary: "", description: "", imageUrl: "", category: "", contactEmail: "", contactPhone: "", cancellationPolicy: "" };
const camposOpcionais = new Set(["summary", "category", "imageUrl", "contactPhone"]);

function Rotulo({ children, obrigatorio = false }: { children: ReactNode; obrigatorio?: boolean }) {
  return <span>{children}{obrigatorio ? <span className="ml-1 text-red-700" aria-hidden="true">*</span> : null}</span>;
}

export default function InformacoesPage() {
  const { id } = useParams<{ id: string }>();
  const [value, setValue] = useState(vazio);
  const [dirty, setDirty] = useState(false);
  const [manualSlug, setManualSlug] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadError, setUploadError] = useState("");
  const changeRevision = useRef(0);

  useEffect(() => {
    fetch(`/eventos-admin/api/eventos/admin/${id}`, { credentials: "include" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error("Falha ao carregar");
        return body;
      })
      .then((event: Partial<InformacoesValue> & { updatedAt?: string }) => {
        setValue((current) => ({ ...current, ...event }));
        setUpdatedAt(event.updatedAt);
      })
      .catch(() => setError("Não foi possível carregar as informações."));
  }, [id]);

  const autosave = useEventoAutosave({
    eventId: id,
    value,
    dirty,
    serialize: (current) => ({ ...construirPayloadInformacoes(current), ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}) }),
    save: async (payload, eventId) => {
      const revision = changeRevision.current;
      const response = await fetch(`/eventos-admin/api/eventos/admin/${eventId}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      assertRespostaApi({ ok: response.ok, status: response.status, body });
      queueMicrotask(() => {
        if (changeRevision.current === revision) {
          setUpdatedAt((body.data ?? body).updatedAt);
          setDirty(false);
        }
      });
    },
    debounceMs: 700,
  });

  const patch = (part: Partial<InformacoesValue>) => {
    changeRevision.current += 1;
    setValue((current) => ({ ...current, ...part }));
    setDirty(true);
  };
  const titleChange = (title: string) => patch({ title, ...(manualSlug ? {} : { slug: slugSugerido(title) }) });
  const enviarImagem = async (file: File) => {
    const revision = changeRevision.current;
    setUploadState("uploading");
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    if (updatedAt) formData.append("expectedUpdatedAt", updatedAt);
    try {
      const response = await fetch(`/eventos-admin/api/eventos/admin/${id}/imagem`, { method: "POST", credentials: "include", body: formData });
      const body = await response.json().catch(() => ({}));
      assertRespostaApi({ ok: response.ok, status: response.status, body });
      const data = (body as { data?: { imageUrl?: string; updatedAt?: string } }).data ?? {};
      if (!data.imageUrl) throw new Error("A API não retornou a imagem enviada.");
      setValue((current) => ({ ...current, imageUrl: data.imageUrl }));
      setUpdatedAt(data.updatedAt);
      setUploadState("idle");
      if (changeRevision.current === revision) setDirty(false);
    } catch (uploadFailure) {
      setUploadState("error");
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "Não foi possível enviar a imagem.");
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-xl font-semibold">Informações básicas</h2>
        <p className="text-sm text-slate-600">O rascunho é salvo continuamente enquanto você edita.</p>
        <p className="mt-2 text-sm text-slate-700"><span className="text-red-700">*</span> Campos obrigatórios: título, slug público, descrição, e-mail de contato e política de cancelamento.</p>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm"><Rotulo obrigatorio>Título</Rotulo><input aria-required="true" value={value.title} onChange={(event) => titleChange(event.target.value)} className="w-full rounded border p-2" /></label>
        <label className="space-y-1 text-sm"><Rotulo obrigatorio>Slug público</Rotulo><input aria-required="true" value={value.slug} onChange={(event) => { setManualSlug(true); patch({ slug: event.target.value }); }} className="w-full rounded border p-2" /></label>
        {(["summary", "category", "contactEmail", "contactPhone"] as const).map((key) => <label key={key} className="space-y-1 text-sm"><Rotulo obrigatorio={!camposOpcionais.has(key)}>{key === "contactEmail" ? "E-mail de contato" : key === "contactPhone" ? "Telefone de contato" : key === "summary" ? "Resumo" : "Categoria"}</Rotulo><input aria-required={!camposOpcionais.has(key)} value={value[key] ?? ""} onChange={(event) => patch({ [key]: event.target.value } as Partial<InformacoesValue>)} className="w-full rounded border p-2" /></label>)}
        <label className="space-y-1 text-sm"><Rotulo>Imagem</Rotulo><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadState === "uploading"} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void enviarImagem(file); }} className="w-full rounded border p-2" />{uploadState === "uploading" && <span className="text-slate-600">Enviando imagem…</span>}{uploadError && <span role="alert" className="text-red-700">{uploadError}</span>}{value.imageUrl && <img src={value.imageUrl} alt={value.title ? `Capa de ${value.title}` : "Capa do evento"} className="mt-2 max-h-48 rounded object-cover" />}</label>
      </div>
      <label className="block space-y-1 text-sm"><Rotulo obrigatorio>Descrição</Rotulo><textarea aria-required="true" value={value.description} onChange={(event) => patch({ description: event.target.value })} className="min-h-32 w-full rounded border p-2" /></label>
      <label className="block space-y-1 text-sm"><Rotulo obrigatorio>Política de cancelamento</Rotulo><textarea aria-required="true" value={value.cancellationPolicy} onChange={(event) => patch({ cancellationPolicy: event.target.value })} className="min-h-24 w-full rounded border p-2" /></label>
      <p className="text-sm text-slate-500" role="status">{autosave.state === "saving" ? "Salvando…" : autosave.state === "saved" ? "Salvo automaticamente" : autosave.state === "conflict" ? "Conflito de edição; recarregue para revisar." : ""}</p>
    </section>
  );
}
