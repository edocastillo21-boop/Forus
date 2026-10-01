# Forus · Etapa 3 (MVP) — punto de avance

> Actualizado el 30-09-2026. **App construida y probada en modo local.** Falta solo ponerla en línea con el usuario.

## Respuestas del usuario a la Etapa 2
- Compartir entre la pareja: **no**, cada uno ve solo lo suyo.
- La novia es **Vanessa**, la misma de Cuentas Claras. Los dos correos están en `supabase/local/autorizar-correos.sql` (fuera de git).
- Discos en **kg**, barra de **20 kg**.
- Diseño aprobado. El usuario tiene GitHub y Supabase abiertos en Chrome.

## Entorno
- `registry.npmjs.org` está bloqueado en este equipo → `.npmrc` usa `https://registry.yarnpkg.com/`.
- Previsualizar: configuración `forus` en `C:\Users\HPM\Claud\.claude\launch.json` (`npm run dev --prefix forus`, puerto 5190). Sin `.env` funciona en **modo local** (uid `local`, sin nube).
- Comandos:
  - `npm run build`: `tsc -p .` y luego `vite build`.
  - `npx vitest run`: 19 pruebas.
  - `npm run data`: regenera los catálogos.

## Hecho
- **Catálogos estáticos**: 203 ejercicios y 477 alimentos (51 preparaciones chilenas), precargados por el service worker, así funcionan sin señal.
- **Núcleo** `src/core/` y **datos** `src/data/`:
  - Dexie por usuario, cola de sincronización push/pull y borrado lógico.
  - `app.tsx`: contexto y `useToday`. `today.ts`: qué toca hoy. `actions.ts`: escrituras comunes.
  - `sync.ts` tiene `startSync`/`stopSync` y marca `pulled` tras la primera bajada, para no mostrar el onboarding antes de tiempo en otro dispositivo.
- **App** (`src/App.tsx`):
  - Autenticación, con limpieza de `#access_token` y de errores en la URL.
  - Primera sincronización, onboarding o la app con 5 pestañas.
  - Tema claro u oscuro. Íconos PWA.
- **Pantallas**:
  - Onboarding (8 pasos + plan con cálculo explicado, rutina sugerida y día de ejemplo).
  - Inicio: racha, entreno de hoy, anillo de kcal, agua, peso, fase, semana y "¿por qué X kcal?".
  - Entrenar:
    - portada con el mesociclo;
    - **modo sesión**: series prellenadas, ✓ en 1 toque, pulsación larga = fallida, descanso fijo con −15/+15/Saltar, sonido y vibración, superseries, drop y rest-pause, discos, técnica, cambiar ejercicio, notas, pantalla encendida;
    - resumen con récords, confeti, próxima vez y post-entreno;
    - rutinas con plantillas y editor (arrastrar y soltar, series/reps/RIR/descanso, superserie, calendario del mesociclo);
    - biblioteca con detalle y 1RM;
    - historial.
  - Comer: diario por comidas, editar y deshacer, copiar el día o una comida, comidas guardadas, agua. Agregar con búsqueda, recientes (+ en 1 toque), favoritos, mis comidas y mis alimentos, y registro rápido. Alimento propio por porción o por 100 g.
  - Progreso: peso con promedio de 7 días y ritmo, fuerza (1RM y récords), series por músculo.
  - Perfil: plan (recalcular / nueva fase), datos, entrenamiento, alimentación, comidas del día, barra y discos, tema, sincronización, exportar JSON, cerrar sesión, eliminar cuenta.
- **Supabase**:
  - `supabase/migrations/0001_forus.sql`: 10 tablas, trigger `updated_at`, RLS por usuario, `allowed_emails` con trigger en `auth.users` y RPC `delete_my_account`.
  - `supabase/local/autorizar-correos.sql`.
- **Publicación**: `netlify.toml` (SPA y caché), `.gitignore`, `.env.example` y `docs/GUIA-DESPLIEGUE.md` (paso a paso para el usuario).
- Probado en el navegador (375 px):
  - onboarding → Inicio;
  - sesión con serie hecha, copia de peso, descanso, discos y terminar → resumen;
  - agregar comida → diario;
  - Progreso, Perfil, tema claro;
  - editor con arrastrar, superserie y calendario;
  - biblioteca y alimento propio.
  - Sin errores en la consola.

## Decisiones de la Etapa 3 (explicar al usuario al cerrar)
- Catálogos globales como archivos estáticos; en Supabase solo viven los datos del usuario.
- Rutinas y sesiones se guardan como documentos (jsonb): **10 tablas** en vez de 34.
- Gasto = TMB (Mifflin-St Jeor) × actividad diaria (1,2–1,7) + entrenamiento (0,07 kcal × kg × min × sesiones / 7).
- Objetivos planos por día en el MVP; el ciclado por tipo de día es de la Etapa 4.
- Después de agregar un alimento se queda en el buscador (botón "Listo · N agregados") para cargar varios seguidos. Es un cambio menor respecto del flujo 3.5.
- Superserie: se arma con un interruptor en el ejercicio, no soltando uno sobre otro.
- Pendiente para la Etapa 4: escáner de código de barras, medidas y fotos, revisión semanal automática, ciclado de carbos, notificación con pantalla bloqueada al terminar el descanso.

## Pendiente
1. Puesta en línea con el usuario, según `docs/GUIA-DESPLIEGUE.md`:
   - el usuario crea el proyecto Supabase;
   - se ejecuta el SQL, con su permiso si se hace desde Chrome;
   - URL + publishable key en `.env.production`;
   - `git init` y push a un repositorio privado (pedir permiso para commit y push);
   - Netlify conectado a GitHub;
   - Site URL en Supabase.
2. Mensaje de cierre de la Etapa 3 (decisiones, supuestos, preguntas) y esperar confirmación para la Etapa 4.
