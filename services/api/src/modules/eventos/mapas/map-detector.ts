import { BadRequestException, Injectable } from "@nestjs/common";
import { XMLParser } from "fast-xml-parser";

export interface MapSeatProposal { rowLabel: string; seatNumber: string; x: number; y: number; width: number; height: number; category?: string; confidence: number; conflict?: string; }
export interface MapDetectionResult { canvas: { width: number; height: number }; seats: MapSeatProposal[]; categories: string[]; confidence: number; conflicts: string[]; detector: string; }

const numberPattern = /^(\d{1,4})$/;
function asNumber(value: unknown, fallback = 0): number { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

@Injectable()
export class MapDetector {
  async detect(input: { buffer: Buffer; mimeType: string }): Promise<MapDetectionResult> {
    const mime = input.mimeType.toLowerCase();
    if (mime === "image/svg+xml" || input.buffer.subarray(0, 200).toString("utf8").includes("<svg")) return this.detectSvg(input.buffer);
    if (mime === "application/pdf" || input.buffer.subarray(0, 5).toString("ascii") === "%PDF-") return this.detectPdf(input.buffer);
    if (mime.startsWith("image/")) return this.detectRaster(input.buffer);
    throw new BadRequestException({ code: "INVALID_MAP_TYPE", message: "Formato de mapa não suportado" });
  }

  private detectSvg(buffer: Buffer): MapDetectionResult {
    const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" }).parse(buffer.toString("utf8"));
    const svg = xml.svg ?? {};
    const width = asNumber(svg["@_width"], asNumber(svg["@_viewBox"]?.split?.(" ")?.[2], 1000));
    const height = asNumber(svg["@_height"], asNumber(svg["@_viewBox"]?.split?.(" ")?.[3], 800));
    const textNodes: unknown[] = [];
    const collect = (node: unknown) => { if (!node || typeof node !== "object") return; if (Array.isArray(node)) return node.forEach(collect); const object = node as Record<string, unknown>; if ("text" in object) { const value = object.text; Array.isArray(value) ? value.forEach((v) => textNodes.push(v)) : textNodes.push(value); } Object.values(object).forEach(collect); };
    collect(svg);
    const seats: MapSeatProposal[] = [];
    for (const node of textNodes) {
      if (typeof node === "string") { const value = node.trim(); if (numberPattern.test(value)) seats.push({ rowLabel: "", seatNumber: value, x: 0, y: seats.length * 24, width: 20, height: 20, confidence: 48 }); continue; }
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>; const value = String(n["#text"] ?? "").trim();
      if (numberPattern.test(value)) seats.push({ rowLabel: "", seatNumber: value, x: asNumber(n["@_x"]), y: asNumber(n["@_y"]), width: 20, height: 20, confidence: 86 });
    }
    const ys = [...new Set(seats.map((seat) => seat.y))].sort((a, b) => a - b);
    for (const seat of seats) { const row = ys.findIndex((y) => Math.abs(y - seat.y) <= 12); seat.rowLabel = String.fromCharCode(65 + Math.max(0, row)); }
    return this.finalize({ canvas: { width, height }, seats, detector: "svg-text-v1" });
  }

  private async detectPdf(buffer: Buffer): Promise<MapDetectionResult> {
    let text = "";
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const positioned: MapSeatProposal[] = [];
      for (let pageNo = 1; pageNo <= document.numPages; pageNo++) { const page = await document.getPage(pageNo); const content = await page.getTextContent(); for (const item of content.items as Array<{ str?: string; transform?: number[] }>) { const value = (item.str ?? "").trim(); text += `${value} `; if (numberPattern.test(value)) positioned.push({ rowLabel: "", seatNumber: value, x: asNumber(item.transform?.[4]), y: asNumber(item.transform?.[5]), width: 24, height: 24, confidence: 80 }); } }
      if (positioned.length) return this.finalize({ canvas: { width: 1200, height: 900 }, seats: positioned.map((seat) => ({ ...seat, x: Math.max(0, Math.min(1199, Math.round(seat.x))), y: Math.max(0, Math.min(899, Math.round(seat.y))), width: 24, height: 24 })), detector: "pdf-text-v1" });
    } catch { text = buffer.toString("latin1"); }
    const seats = [...text.matchAll(/\b(\d{1,4})\b/g)].map((match, index) => ({ rowLabel: "", seatNumber: match[1], x: (index % 20) * 28, y: Math.floor(index / 20) * 28, width: 24, height: 24, confidence: 58 }));
    return this.finalize({ canvas: { width: 1200, height: 900 }, seats, detector: "pdf-text-v1" });
  }

  private async detectRaster(buffer: Buffer): Promise<MapDetectionResult> {
    let width = 1200; let height = 900;
    try {
      const sharp = (await import("sharp")).default; const metadata = await sharp(buffer).metadata(); width = metadata.width ?? width; height = metadata.height ?? height;
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(buffer);
      await worker.terminate();
      const words = (result.data as any).words as Array<{ text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }> | undefined;
      const boxed = (words ?? []).filter((word) => numberPattern.test((word.text ?? "").trim()) && word.bbox);
      const seats = boxed.length ? boxed.map((word) => ({ rowLabel: "", seatNumber: word.text!.trim(), x: Math.round(word.bbox!.x0), y: Math.round(word.bbox!.y0), width: Math.max(1, Math.round(word.bbox!.x1 - word.bbox!.x0)), height: Math.max(1, Math.round(word.bbox!.y1 - word.bbox!.y0)), confidence: Math.round(word.confidence ?? 45) })) : [...result.data.text.matchAll(/\b(\d{1,4})\b/g)].map((match, index) => ({ rowLabel: "", seatNumber: match[1], x: (index % 20) * 28, y: Math.floor(index / 20) * 28, width: 24, height: 24, confidence: 45 }));
      return this.finalize({ canvas: { width, height }, seats, detector: "raster-ocr-v1" });
    } catch { return this.finalize({ canvas: { width, height }, seats: [], detector: "raster-ocr-v1" }); }
  }

  private finalize(value: { canvas: { width: number; height: number }; seats: MapSeatProposal[]; detector: string }): MapDetectionResult {
    const seen = new Set<string>(); const conflicts: string[] = [];
    for (const seat of value.seats) { const key = `${seat.rowLabel}:${seat.seatNumber}`; if (seen.has(key)) { seat.conflict = "DUPLICATE_SEAT"; conflicts.push(key); } seen.add(key); }
    const confidence = value.seats.length ? Math.round(value.seats.reduce((sum, seat) => sum + seat.confidence, 0) / value.seats.length) : 0;
    return { ...value, categories: [], confidence, conflicts };
  }
}
