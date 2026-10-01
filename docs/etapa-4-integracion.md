# Forus · Etapa 4: entrenamiento y comida conectados

> Actualizado el 01-10-2026. **Estado: en línea** en https://forus-app.netlify.app (commit d15efb5), con los ajustes pedidos por el usuario (ver "Respuestas del usuario"). La migración `0002_etapa4.sql` se ejecutó en Supabase antes de subir el código.

## Respuestas del usuario (01-10-2026)
1. **Teléfonos:** uno usa Android y el otro iPhone. En iPhone la notificación de fin de descanso no es exacta con la pantalla bloqueada; para eso haría falta push desde un servidor (Etapa 5).
2. **Intensidad del ciclado:** que dependa del objetivo y de las calorías de cada uno, y que se aplique solo si corresponde. Se implementó así:

   | Objetivo | Intensidad | Motivo |
   |---|---|---|
   | Recomposición | Marcada (0,55) | Comer sobre el gasto al entrenar y bajo él al descansar |
   | Definición | Media (0,45) | Proteger el rendimiento y concentrar el déficit en el descanso |
   | Mantención | Media-suave (0,35) | Acompañar lo que se entrena sin cambiar el peso |
   | Volumen | Suave (0,25) | Ya hay superávit todos los días |

   - Si las calorías no dan margen, la intensidad se achica (aviso "achicado por tus calorías").
   - Si el margen no alcanza ni para una amplitud de 0,12, el ciclado no se aplica y se explica por qué.
   - Perfil, "Nueva fase", el onboarding y "¿Por qué?" muestran la intensidad y su motivo.
3. **Revisión semanal: el domingo.**
   - Revisa los 14 días hasta el sábado.
   - La tarjeta aparece el domingo y queda hasta que se decida.

## Qué hace

### 1. Ciclado de carbohidratos: cada día tiene su objetivo
- **Tipo de día según lo que entrenas.** Se calcula con las series efectivas cuyo músculo principal es de pierna:
  - pierna: 60 % o más;
  - torso: 25 % o menos;
  - cuerpo completo: entre medio.
  - El nombre del día no importa: un día de glúteos cuenta como pierna.
- **Demanda de cada tipo de día:** pierna 1,0 · cuerpo completo 0,85 · torso 0,6 · descanso 0. En la semana de descarga, el entrenamiento vale la mitad.
- **Qué cambia y qué no:**
  - la proteína y la grasa no cambian;
  - los carbohidratos se mueven según el objetivo (tabla de arriba), como fracción de la distancia entre la demanda del día y el promedio de la semana planificada;
  - el promedio semanal sigue siendo el de la fase.
- **Ejemplo** (Torso-Pierna, 4 días, volumen con 2.860 kcal de promedio, intensidad suave): pierna 3.080 · torso 2.920 · descanso 2.680 kcal.
- **Piso de seguridad:** un día de descanso nunca baja de 1,5 g de carbohidratos por kg, ni de 100 g. Si no alcanza, la oscilación se achica.
- **Pasado, hoy y futuro:**
  - en el pasado manda lo que hiciste: con sesión registrada es día de entrenamiento; sin sesión, de descanso;
  - hoy y en adelante manda el calendario, salvo que ya hayas entrenado;
  - por eso, si mueves un entrenamiento, cambian las dos fechas.
- **Dónde se ve:**
  - Inicio: chip "Día de pierna · +85 g de carbohidratos", "¿Por qué?" con el cálculo completo y "Objetivos por día" con los 7 días de la semana;
  - tarjeta "Hoy toca";
  - Diario, Agregar alimento, resumen de la sesión;
  - la racha ("día cumplido") usa el objetivo de cada día.
- **Se puede apagar** en Perfil → Tu plan. Ahí también se ven las kcal por tipo de día.
- **Fases nuevas:** traen el ciclado activado. "Nueva fase" y el onboarding muestran la vista previa por día.
- **Agua:** +0,5 L los días de entrenamiento.

### 2. Reparto por comida y pre/post entreno
- **Reparto base del día:** desayuno 22 %, colación 10 %, almuerzo 32 %, once 16 %, cena 20 %. La proteína se reparte parejo entre las comidas principales; las colaciones llevan la mitad.
- **Días de entrenamiento:** según la hora (la de la sesión real o la habitual del perfil):
  - pre-entreno: la comida entre 30 min y 3 h antes;
  - post-entreno: la comida entre 45 min y 4 h después;
  - las dos llevan ×1,6 de carbohidratos y ×0,5 de grasa.
- **Diario:** cada comida muestra "0 / 580 kcal", su meta de proteína y carbohidratos, y la etiqueta Pre-entreno o Post-entreno.
- **Inicio:** "Antes de entrenar · Once 18:00: ~82 g de carbohidratos y 31 g de proteína…". Después de entrenar queda solo la comida de recuperación.
- **Resumen de la sesión:** dice cuánto te queda y qué apuntar en la próxima comida.

### 3. Revisión semanal (el domingo, hasta que decides)
- **Qué revisa:** los 14 días hasta el sábado, desde el inicio de la fase si es más reciente; necesita al menos 10 días.
- **Datos mínimos:** 4 pesajes y 5 días con la comida registrada por semana. Un día cuenta si llega al menos a la mitad de su objetivo. Si faltan datos, pide constancia en vez de ajustar.
- **Balance energético con datos reales:**
  - ritmo del peso: pendiente de los pesajes (mínimos cuadrados);
  - gasto real = lo que comiste − ritmo × 7.700 / 7;
  - lo necesario = gasto real + ritmo objetivo × 7.700 / 7;
  - se corrige el 75 % de la diferencia, redondeado a 50 kcal y con un máximo de ±300 kcal por semana, sin bajar del piso de 1.500 kcal (hombres) o 1.200 kcal (mujeres);
  - con los datos de prueba de la fórmula: subió 0,05 kg/sem (objetivo 0,25) → **+150 kcal**.
- **Antes de proponer un ajuste:**
  - si comiste a más de un 12 % de tu objetivo, primero pide acercarte a él;
  - si el ritmo está dentro de ±0,1 kg/sem (o ±30 % del objetivo), te dice "Vas en línea";
  - si llegaste a tu peso objetivo, felicita y sugiere una fase de mantención.
- **Opciones:** Aplicar · Esperar una semana · Entendido · ¿Por qué?
- **Aplicar** crea una fase nueva desde hoy con +X kcal, todas en carbohidratos.
  - Las fechas pasadas conservan su objetivo.
  - "Semana N de la fase" sigue contando desde el inicio del bloque (columna `phases.block_start`).
  - El ajuste aparece en el historial de fases y en "¿Por qué?" como "Ajustes con tu progreso real".
  - La decisión se guarda en `weekly_checkins` (id = usuario + domingo de la revisión), así no reaparece en el otro teléfono.

### 4. Escáner de código de barras + Open Food Facts
- **El botón** está dentro del buscador de Agregar alimento.
- **Cómo lee el código:**
  - Android usa el detector nativo;
  - iPhone usa ZXing en WebAssembly. Va dentro de la app (~460 kB comprimido), se descarga solo la primera vez que escaneas y queda guardado.
  - También se puede escribir el número.
- **Cómo busca el producto:**
  1. En tus alimentos: si ya lo escaneaste, abre directo la cantidad.
  2. En Open Food Facts (solo se envía el código).
  3. Si lo encuentra, abre "Nuevo alimento" lleno, por 100 g, para revisarlo contra la etiqueta. Al guardar, pasa directo a la cantidad.
  4. Si no lo encuentra, pide copiar la tabla nutricional del envase, y lo recuerda para la próxima.
- **Atribución ODbL** en el pie de Perfil.

### 5. Medidas corporales
- **Medidas:** cintura, cadera, pecho, brazo, muslo y cuello. Cada una trae su instrucción de cómo medir.
- **Pantalla:**
  - gráfico por medida;
  - cambio desde la primera medición;
  - recordatorio cada 2 semanas.
- **% de grasa estimado** con la fórmula de la Marina de EE. UU. (cintura y cuello, más cadera en mujeres). Se avisa que yerra ±3–4 puntos, pero sirve para ver la tendencia.

### 6. Fotos de progreso
- **Poses:** frente, perfil y espalda. "Antes y ahora" lado a lado, con el peso de esa fecha.
- **Cómo se guardan:**
  - la app las achica a 1.280 px en JPEG;
  - eso borra los metadatos EXIF, incluida la ubicación GPS;
  - se guardan primero en el teléfono y se suben solas.
- **Privacidad:**
  - bucket privado `progress-photos` en Supabase;
  - cada persona solo accede a su carpeta;
  - la app las descarga con tu sesión, sin enlaces públicos.
- **Eliminar la cuenta** borra también las fotos de la nube.

### 7. Aviso de fin de descanso con notificación
- Se activa en Perfil → "Aviso de fin de descanso". Pide permiso al navegador.
- Si el descanso termina con la app en segundo plano, llega una notificación. Al tocarla, vuelves a la app.
- **Límite de la web:**
  - Android la entrega casi siempre, también con la pantalla apagada;
  - iPhone pausa la app al bloquear, así que la notificación puede llegar tarde;
  - para que sea exacta en iPhone se necesitaría un servidor de notificaciones push (Etapa 5, si lo quieren).

## Decisiones y supuestos
- **Sin tabla `daily_targets`:** el objetivo de cada fecha se calcula al vuelo desde la fase, la rutina y las sesiones (`src/data/targets.ts`). Así no se desincroniza, y mover un entrenamiento lo recalcula solo. Las fases guardan la historia.
- **Ajuste semanal = fase nueva** y no una edición de la fase actual: los días pasados no cambian de objetivo y la racha no se altera.
- **El ajuste usa lo que realmente comiste** (balance energético, como MacroFactor) y no solo el peso. Con buena adherencia es más preciso; por eso exige registros completos.
- **La revisión corre en el teléfono** al abrir la app (no con pg_cron en el servidor): funciona sin señal y no necesita funciones de servidor.
- **El plan semanal automático y la lista de compras quedan para la Etapa 5**, como se acordó al quitar el cobro.
- **Base de datos:**
  - 3 tablas nuevas: `body_measurements`, `progress_photos` y `weekly_checkins`;
  - 1 columna: `phases.block_start`;
  - 1 bucket privado;
  - en total quedan 13 tablas.

## Archivos
- **Núcleo (con pruebas):**
  - `src/core/cycling.ts`, `meals.ts`, `review.ts`, `body.ts`;
  - `src/core/etapa4.test.ts`: 24 pruebas. En total pasan 43.
- **Datos:**
  - `src/data/targets.ts`: objetivo por fecha;
  - `photos.ts`: fotos y su cola de subida;
  - `off.ts`: Open Food Facts;
  - tablas nuevas en `types.ts`, `db.ts` (Dexie v2) y `hooks.ts`.
- **Pantallas:**
  - `features/home/Review.tsx`;
  - `features/eat/Scanner.tsx`;
  - `features/progress/Measures.tsx` y `Photos.tsx`;
  - cambios en Inicio, Diario, Agregar, Alimento propio, Resumen, Sesión, Perfil, Onboarding y Progreso.
- **Otros:**
  - `public/sw-notify.js`: al tocar la notificación se vuelve a la app;
  - `supabase/migrations/0002_etapa4.sql`.

## Probado (navegador, 375 px, modo local)
- **Ciclado:**
  - el perfil muestra las kcal por tipo de día y la intensidad según el objetivo (volumen suave, definición media, recomposición marcada);
  - Inicio muestra el chip, pre/post entreno, agua +0,5 L, "¿Por qué?" y los objetivos de la semana;
  - el Diario muestra las metas por comida y las etiquetas pre/post.
- **Escáner** (la cámara está bloqueada en el navegador de pruebas, así que se usó el número manual):
  - Nutella 3017620422003 → Open Food Facts → formulario lleno → guardar → cantidad;
  - el segundo escaneo lo encuentra en "mis alimentos";
  - ZXing en WebAssembly decodificó un EAN-13 dibujado en el navegador (sin detector nativo, como en iPhone).
- **Revisión semanal** con 14 días simulados:
  - propuso +150 kcal;
  - "¿Por qué?" mostró el cálculo;
  - "Aplicar" dejó la fase en 2.860 kcal y la tarjeta desapareció;
  - "Semana 5" se mantuvo.
- **Progreso:** medidas (gráfico y 16,5 % de grasa estimada) y fotos (grilla y "antes y ahora").
- **Resto:**
  - resumen post-entreno;
  - onboarding con kcal por día para Torso-Pierna, PPL y Full Body;
  - sesión con descanso;
  - modo claro;
  - sin errores en la consola.
- **No probado:** la cámara real, la notificación con el teléfono bloqueado y la subida de fotos a Supabase. Las tres se prueban en el teléfono después de publicar.

## Publicado (01-10-2026)
1. Supabase → SQL Editor: se ejecutó `0002_etapa4.sql` ("Run and enable RLS"; resultado "Success").
   - Verificado: 3 tablas con RLS y su política, `phases.block_start`, el bucket `progress-photos` privado de 5 MB y la política `forus_fotos_propias`.
2. `git push` → Netlify publicó `d15efb5`. Verificado en línea: bundle nuevo, `sw-notify.js` y motor ZXing (`.wasm`) responden 200. La app se actualiza sola al abrirla.

## Pendiente
- En los teléfonos, probar la cámara del escáner, la subida de fotos y la notificación de descanso (Android, y en iPhone con la app instalada en la pantalla de inicio).
- Esperar la confirmación del usuario para la Etapa 5 (funciones avanzadas: coach con IA, plan semanal y lista de compras, alertas de micronutrientes, foto de comida, push exacto en iPhone).
