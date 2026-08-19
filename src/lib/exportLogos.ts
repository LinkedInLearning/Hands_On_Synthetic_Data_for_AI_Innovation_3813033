/**
 * Brand marks used in the generated PDF / PPTX / DOCX documents.
 *
 * The assets are imported as URLs and converted to base64 data URIs at export
 * time — the exporters run in the browser and every document library needs the
 * raw bytes rather than a path.
 */
import ydataWhiteUrl from "@/assets/ydata-logo-white.png";
import kpmgWhiteUrl from "@/assets/kpmg-white.png";

/** KPMG blue — used to tint the white marks for light document backgrounds. */
const BRAND_BLUE = "#00338D";

export interface BrandLogos {
  ydataWhite: string;
  ydataBlue: string;
  kpmgWhite: string;
  kpmgBlue: string;
}

/** The "YData by KPMG" endorsement wording used beside the KPMG mark. */
export const ENDORSEMENT = "YData by";

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Recolors a white, alpha-masked mark so it reads on a light background. */
async function tint(dataUri: string, color: string): Promise<string> {
  const img = new Image();
  img.src = dataUri;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUri;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

let cached: Promise<BrandLogos> | null = null;

export function loadLogos(): Promise<BrandLogos> {
  if (!cached) {
    cached = (async () => {
      const [ydataWhite, kpmgWhite] = await Promise.all([
        toDataUri(ydataWhiteUrl),
        toDataUri(kpmgWhiteUrl),
      ]);
      const [ydataBlue, kpmgBlue] = await Promise.all([
        tint(ydataWhite, BRAND_BLUE),
        tint(kpmgWhite, BRAND_BLUE),
      ]);
      return { ydataWhite, ydataBlue, kpmgWhite, kpmgBlue };
    })();
    // A rejected promise must not stay in the cache, or one transient failure
    // would break every export for the rest of the session.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

/** Strips the `data:` prefix — pptxgenjs wants `image/png;base64,…`. */
export function pptxData(dataUri: string) {
  return dataUri.replace(/^data:/, "");
}

/** Raw bytes for docx's ImageRun. */
export function toUint8(dataUri: string): Uint8Array {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
