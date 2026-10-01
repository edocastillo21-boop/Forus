// Escáner de código de barras con la cámara. Usa el detector nativo del teléfono si existe (Android)
// y si no, ZXing en WebAssembly (iPhone). El motor se descarga solo la primera vez que se usa.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/Icon';
import { vibrate } from '../../ui/kit';
import { validBarcode } from '../../data/off';

interface Detector { detect: (src: HTMLVideoElement | HTMLCanvasElement) => Promise<{ rawValue: string }[]> }
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export async function makeDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats: () => Promise<string[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      if (FORMATS.some((f) => supported.includes(f))) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
    } catch { /* se usa ZXing */ }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  // El motor va dentro de la app (no se pide a otro servidor).
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
  return new BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
}

export function Scanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'iniciando' | 'buscando' | 'sin_camara'>('iniciando');
  const [manual, setManual] = useState('');
  const done = useRef(false);
  const cb = useRef(onResult);
  cb.current = onResult;

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
          if (t - last > 180 && v.readyState >= 2) {
            last = t;
            try {
              const found = (await detector.detect(v)).find((b) => validBarcode(b.rawValue));
              if (found && alive && !done.current) {
                done.current = true;
                vibrate(80);
                cb.current(found.rawValue);
                return;
              }
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

  const submitManual = () => { const c = manual.replace(/\D/g, ''); if (validBarcode(c)) { done.current = true; cb.current(c); } };

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
        <p className="small" style={{ textAlign: 'center', marginBottom: 10 }}>
          {status === 'iniciando' ? 'Abriendo la cámara…' : status === 'buscando' ? 'Apunta al código de barras del envase' : 'No pudimos usar la cámara. Revisa el permiso del navegador o escribe el número.'}
        </p>
        <div className="row">
          <input className="input grow" inputMode="numeric" placeholder="O escribe el número" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }} />
          <button className="btn btn-primary" style={{ width: 96, flex: 'none' }} disabled={!validBarcode(manual.replace(/\D/g, ''))} onClick={submitManual}>Buscar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
