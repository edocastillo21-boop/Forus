// Lee la tabla nutricional de una foto o captura con Tesseract. El OCR corre en el teléfono: la imagen
// no se sube a ningún lado. El motor y el modelo de español (~6 MB) se descargan de la propia app la
// primera vez y quedan guardados.
import type { Worker } from 'tesseract.js';
import { decodeImage } from './photos';
import { mainFound, norm, parseLabel, type LabelRead, type OcrWord } from '../core/label';

export type OcrStage = 'cargando' | 'leyendo' | 'acercando' | 'girando';

type Img = Awaited<ReturnType<typeof decodeImage>>;
type Rot = 0 | 90 | 270;
interface Rect { x: number; y: number; w: number; h: number }

/**
 * Dibuja la imagen girada `rot` grados, a escala `scale` y recortada a `rect` (en píxeles de la imagen
 * ya girada), en gris y con el contraste estirado: así el OCR lee mejor fotos con poca luz.
 */
function render(img: Img, rot: Rot, scale: number, rect?: Rect): HTMLCanvasElement {
  const r = rect ?? { x: 0, y: 0, w: rot ? img.h : img.w, h: rot ? img.w : img.h };
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w * scale));
  c.height = Math.max(1, Math.round(r.h * scale));
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.scale(scale, scale);
  g.translate(-r.x, -r.y);
  if (rot === 90) { g.translate(img.h, 0); g.rotate(Math.PI / 2); }
  if (rot === 270) { g.translate(0, img.w); g.rotate(-Math.PI / 2); }
  g.drawImage(img.source, 0, 0, img.w, img.h);
  const data = g.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const v = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = v;
    hist[v | 0]++;
  }
  const total = px.length / 4;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
  const stretch = hi - lo > 10;
  for (let i = 0; i < px.length; i += 4) {
    const v = stretch ? ((px[i] - lo) * 255) / (hi - lo) : px[i];
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  g.putImageData(data, 0, 0);
  return c;
}

/** Escala de la primera pasada: lado mayor entre 1.600 y 2.400 px (como máximo el triple). */
const firstScale = (img: Img) => {
  const side = Math.max(img.w, img.h);
  return side > 2400 ? 2400 / side : side < 1600 ? Math.min(3, 1600 / side) : 1;
};

const KEYWORD = /energ|calor|prot|grasa|lipid|hidrat|carbo|azuc|fibra|sodio|porci|nutri|kcal/;

/**
 * Dónde está la tabla y qué tan alta sale la letra (en píxeles de la pasada). Sirve para volver a leer
 * solo esa zona, ampliada, cuando la tabla es chica dentro de la foto.
 */
function tableZone(lines: OcrWord[][]): { box: Rect; textH: number } | null {
  const words = lines.flat();
  const keys = words.filter((w) => KEYWORD.test(norm(w.text)));
  if (keys.length < 2) return null;
  // Cuartil inferior: las palabras que tocan las líneas de la tabla salen más altas de lo que son.
  const hs = keys.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const textH = hs[Math.floor(hs.length / 4)];
  const top = Math.min(...keys.map((w) => w.y0)) - textH * 2;
  const bottom = Math.max(...keys.map((w) => w.y1)) + textH * 2;
  const band = words.filter((w) => (w.y0 + w.y1) / 2 >= top && (w.y0 + w.y1) / 2 <= bottom);
  const pad = textH * 2;
  const x0 = Math.min(...band.map((w) => w.x0)) - pad;
  const x1 = Math.max(...band.map((w) => w.x1)) + pad;
  return { box: { x: x0, y: top, w: x1 - x0, h: bottom - top }, textH };
}

async function startWorker(log: (status: string, p: number) => void): Promise<Worker> {
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const dir = new URL(__OCR_DIR__, location.href).href;
  const worker = await createWorker('spa', OEM.LSTM_ONLY, {
    workerPath: `${dir}worker.min.js`,
    workerBlobURL: false,
    corePath: dir,
    langPath: dir,
    // El service worker ya guarda los archivos; así no quedan dos copias.
    cacheMethod: 'none',
    logger: (m) => log(m.status, m.progress),
  });
  // Texto disperso: con los otros modos las líneas de la tabla hacen que se salte columnas enteras.
  // Las filas se rearman después con la posición de cada palabra (core/label.ts).
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}

async function ocr(worker: Worker, canvas: HTMLCanvasElement): Promise<OcrWord[][]> {
  const { data } = await worker.recognize(canvas, { rotateAuto: true }, { blocks: true, text: false });
  return (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => l.words.map((w) => ({ text: w.text, ...w.bbox })))));
}

const score = (r: LabelRead | null) => (r ? mainFound(r) * 10 + Object.keys(r.values).length + (r.sure ? 3 : 0) + (r.portion ? 1 : 0) : 0);

/**
 * Lee la tabla nutricional. Si la letra sale chica, vuelve a leer solo la tabla, ampliada. Si no la
 * encuentra derecha, prueba la imagen girada (muchas tablas van impresas de costado).
 * Devuelve null si no hay nada que se parezca a una tabla.
 */
export async function readLabel(file: Blob, onProgress: (stage: OcrStage, p: number) => void, signal?: AbortSignal): Promise<LabelRead | null> {
  const img = await decodeImage(file);
  let worker: Worker | null = null;
  const stop = () => { const w = worker; worker = null; w?.terminate().catch(() => {}); };
  signal?.addEventListener('abort', stop);
  let stage: OcrStage = 'cargando';
  try {
    worker = await startWorker((status, p) => {
      if (status === 'recognizing text') onProgress(stage, p);
      else if (stage === 'cargando') onProgress('cargando', status === 'loading language traineddata' ? 0.4 + p * 0.5 : status.startsWith('initializ') ? 0.9 : p * 0.4);
    });
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    const w = worker;
    const k = firstScale(img);
    let best: LabelRead | null = null;
    for (const rot of [0, 90, 270] as const) {
      stage = rot ? 'girando' : 'leyendo';
      onProgress(stage, 0);
      const lines = await ocr(w, render(img, rot, k));
      let r = parseLabel(lines);
      // Segunda pasada sobre la tabla ampliada (letra de ~32 px), si la letra salió chica o faltaron datos.
      const zone = tableZone(lines);
      if (zone && (zone.textH < 20 || mainFound(r) < 4 || !r?.sure)) {
        const box = { x: zone.box.x / k, y: zone.box.y / k, w: zone.box.w / k, h: zone.box.h / k };
        const s = Math.min(4, (32 / zone.textH) * k, 3000 / Math.max(box.w, box.h));
        if (s > k * 1.25) {
          stage = 'acercando';
          onProgress(stage, 0);
          const r2 = parseLabel(await ocr(w, render(img, rot, s, box)));
          if (score(r2) >= score(r)) r = r2;
        }
      }
      if (score(r) > score(best)) best = r;
      if (mainFound(best) >= 2) break;
    }
    return best;
  } finally {
    signal?.removeEventListener('abort', stop);
    img.done();
    stop();
  }
}

