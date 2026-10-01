// Escáner de código de barras con la cámara o desde una foto / captura de pantalla. Usa el detector
// nativo del teléfono si existe (Android) y si no, ZXing en WebAssembly (iPhone). El motor se
// descarga solo la primera vez que se usa.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/Icon';
import { vibrate } from '../../ui/kit';
import { validBarcode } from '../../data/off';
import { decodeImage } from '../../data/photos';

interface Detector { detect: (src: HTMLVideoElement | HTMLCanvasElement) => Promise<{ rawValue: string }[]> }
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

async function nativeDetector(): Promise<Detector | null> {
  const Native = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats: () => Promise<string[]> } }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = await Native.getSupportedFormats();
    if (FORMATS.some((f) => supported.includes(f))) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
  } catch { /* se usa ZXing */ }
  return null;
}

async function zxingDetector(): Promise<Detector> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  // El motor va dentro de la app (no se pide a otro servidor).
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
  return new BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
}

export async function makeDetector(): Promise<Detector> {
  return (await nativeDetector()) ?? zxingDetector();
}

/** Copia la imagen a un lienzo de `max` px por lado (girada 90° si `rot`), sobre fondo blanco por las capturas PNG con transparencia. */
function frame(img: { source: CanvasImageSource; w: number; h: number }, max: number, rot: boolean): HTMLCanvasElement {
  const k = Math.min(1, max / Math.max(img.w, img.h));
  const w = Math.round(img.w * k);
  const h = Math.round(img.h * k);
  const c = document.createElement('canvas');
  c.width = rot ? h : w;
  c.height = rot ? w : h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  if (rot) { g.translate(h, 0); g.rotate(Math.PI / 2); }
  g.drawImage(img.source, 0, 0, w, h);
  return c;
}

/**
 * Busca un código de barras en una foto o captura de pantalla. Prueba en varios tamaños (a resolución
 * completa sirve cuando el código sale chico en una foto grande) y girada (códigos verticales); si el
 * detector del teléfono no lo encuentra, intenta con ZXing.
 */
export async function readBarcodeFromImage(file: Blob): Promise<string | null> {
  const img = await decodeImage(file);
  try {
    const side = Math.max(img.w, img.h);
    const tries: [number, boolean][] = [];
    for (const [max, rot] of [[2000, false], [4000, false], [1000, false], [2000, true]] as const) {
      const px = Math.min(side, max);
      if (!tries.some(([p, r]) => p === px && r === rot)) tries.push([px, rot]);
    }
    const native = await nativeDetector();
    const engines = native ? [async () => native, zxingDetector] : [zxingDetector];
    for (const engine of engines) {
      const detector = await engine();
      for (const [max, rot] of tries) {
        try {
          const found = (await detector.detect(frame(img, max, rot))).find((b) => validBarcode(b.rawValue));
          if (found) return found.rawValue;
        } catch { /* se prueba el siguiente tamaño */ }
      }
    }
    return null;
  } finally {
    img.done();
  }
}

export function Scanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'iniciando' | 'buscando' | 'sin_camara'>('iniciando');
  const [fromImage, setFromImage] = useState<'leyendo' | 'sin_codigo' | 'error' | null>(null);
  const [manual, setManual] = useState('');
  const done = useRef(false);
  const paused = useRef(false);
  const cb = useRef(onResult);
  cb.current = onResult;

  const finish = (code: string) => {
    if (done.current) return;
    done.current = true;
    vibrate(80);
    cb.current(code);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (!alive) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const detector = await makeDetector();
        if (!alive) return;
        setStatus('buscando');
        let last = 0;
        const tick = async (t: number) => {
          if (!alive || done.current) return;
          if (!paused.current && t - last > 180 && v.readyState >= 2) {
            last = t;
            try {
              const found = (await detector.detect(v)).find((b) => validBarcode(b.rawValue));
              if (found && alive) { finish(found.rawValue); return; }
            } catch { /* cuadro ilegible: se sigue intentando */ }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (alive) setStatus('sin_camara');
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((tr) => tr.stop()); };
  }, []);

  async function readImage(f: Blob | undefined) {
    if (!f || done.current) return;
    paused.current = true;
    setFromImage('leyendo');
    try {
      const code = await readBarcodeFromImage(f);
      if (code) { finish(code); return; }
      setFromImage('sin_codigo');
    } catch {
      setFromImage('error');
    } finally {
      paused.current = false;
      // En iPhone el video se detiene mientras está abierto el selector de fotos.
      video.current?.play().catch(() => {});
    }
  }

  // En el computador también se puede pegar una captura (Ctrl+V).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const img = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (img) { e.preventDefault(); void readImage(img); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const submitManual = () => { const c = manual.replace(/\D/g, ''); if (validBarcode(c)) finish(c); };

  const message = fromImage === 'leyendo' ? 'Buscando el código en la imagen…'
    : fromImage === 'sin_codigo' ? 'No encontramos un código de barras en esa imagen. Prueba con una donde se vea completo y nítido, o escribe el número.'
    : fromImage === 'error' ? 'No pudimos abrir esa imagen. Prueba con otra (JPG o PNG).'
    : status === 'iniciando' ? 'Abriendo la cámara…'
    : status === 'buscando' ? 'Apunta al código de barras del envase'
    : 'No pudimos usar la cámara. Elige una foto o captura del código, o escribe el número.';

  return createPortal(
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <video ref={video} playsInline muted />
      <div className="scan-top">
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        <b>Escanear código</b>
        <span style={{ width: 44 }} />
      </div>
      {status !== 'sin_camara' && <div className="scan-frame"><i /></div>}
      <div className="scan-bottom">
        <p className="small" role="status" style={{ textAlign: 'center', marginBottom: 10 }}>{message}</p>
        <div className="row">
          <input className="input grow" inputMode="numeric" placeholder="O escribe el número" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }} />
          <button className="btn btn-primary" style={{ width: 96, flex: 'none' }} disabled={!validBarcode(manual.replace(/\D/g, ''))} onClick={submitManual}>Buscar</button>
        </div>
        <button className="btn scan-img" disabled={fromImage === 'leyendo'} onClick={() => file.current?.click()}>
          {fromImage === 'leyendo' ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Icon name="image" size={18} />}
          Leer de una foto o captura
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void readImage(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </div>,
    document.body,
  );
}
