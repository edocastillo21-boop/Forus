# Forus · Etapa 2 — Flujos de usuario y estructura de pantallas

> **Estado:** propuesta para revisión. Etapa 1 aprobada con ajustes el 30-09-2026.
> **Prototipo navegable:** `etapa-2-prototipo.html` (ábrelo en el navegador; en el celular se ve a pantalla completa).
> **Fecha:** 30-09-2026

---

## 0. Ajustes a la Etapa 1 según tus respuestas

| Tema | Decisión | Efecto |
|---|---|---|
| Usuarios | Solo tú y tu novia | Registro cerrado: solo se pueden crear cuentas con los 2 correos autorizados (igual que Cuentas Claras) |
| Cobro | No hay | Se eliminan `subscriptions` y el modo profesional (`coach_clients`). **Todas las funciones "premium" quedan disponibles para ambos.** La Etapa 5 pasa a llamarse "Funciones avanzadas": coach con IA, alertas de micronutrientes, foto de comida, informes PDF y plan semanal automático |
| Plataforma | PWA con React + Vite | Se instala desde el navegador del celular ("Agregar a pantalla de inicio") |
| Login | Correo + contraseña | Sin "Iniciar sesión con Apple", así que no hace falta pagar Apple Developer |
| Costos | Plan gratis de Supabase y Netlify | Con uso diario el proyecto no se pausa. La IA es opcional y se paga por uso, con tu propia clave |
| Contenido | Imágenes estáticas + base amplia de alimentos | Meta: ~2.000 alimentos genéricos (USDA, traducidos), ~150 preparaciones chilenas calculadas como recetas y productos por código de barras (Open Food Facts). **Los valores nutricionales siempre vienen de la fuente; nunca se inventan** |
| Nombre y estilo | **Forus**, oscuro + naranjo, con modo claro | Ver sección 5 |
| Día cumplido | kcal dentro de ±10 %, proteína ≥ 90 % y sesión registrada si tocaba entrenar | Alimenta la racha de Inicio |
| Ley 21.719 | Aplica a quien trata datos de otros; en uso personal el peso legal baja | Igual se mantiene RLS, fotos privadas y la opción de exportar y borrar la cuenta |

**Modelo de datos:** baja de 49 a **47 tablas** (se eliminan `subscriptions` y `coach_clients`). La función `can_access(user_id)` se mantiene: hoy significa "soy yo" y, si decides compartir cosas con tu pareja (pregunta 1), se amplía sin tocar el resto.

---

## 1. Principios de experiencia

1. **Regla del pulgar:** las acciones principales van en la mitad inferior. Los botones miden como mínimo 48 px de alto, y 56 px o más en el modo sesión.
2. **Tope de toques:**
   - registrar una serie hecha como se sugirió: **1 toque**;
   - registrar un alimento reciente: **2 toques**;
   - peso: **2 toques**;
   - agua: **1 toque**.
3. **Todo viene prellenado:** la serie trae el peso y las repeticiones sugeridas, el peso trae el último valor y las porciones vienen en medidas caseras.
4. **Deshacer en lugar de confirmar:** las acciones rápidas muestran un aviso con "Deshacer" y no un "¿Estás seguro?".
5. **Cada número se explica:** cada objetivo tiene su "¿por qué?". Ejemplo: "hoy 3.240 porque toca pierna".
6. **En el gimnasio:** pantalla siempre encendida durante la sesión, temporizador siempre visible y funcionamiento sin señal.
7. **Celebrar solo lo que importa:** récords reales, rachas y metas de fase. Nada de confeti por abrir la app.

---

## 2. Mapa de pantallas

Barra inferior con 5 secciones. El **modo sesión**, el **onboarding** y **agregar alimento** se abren a pantalla completa, sin la barra.

```
Inicio
├─ Resumen del día: qué entreno hoy, kcal y macros restantes, agua, peso, racha
├─ Tarjeta de fase (semana X de Y, ritmo real vs. objetivo)
├─ Revisión semanal (cuando corresponde)            ← Etapa 4
└─ "¿Por qué este objetivo hoy?"

Entrenar
├─ Mesociclo actual (semana, RIR objetivo, descarga)
├─ Sesión de hoy → [Modo sesión] → Resumen de sesión
├─ Mis rutinas → Editor de rutina → Editor del día (arrastrar y soltar)
│                                  → Configurar ejercicio (series, reps, RIR, descanso, tempo, superserie)
├─ Plantillas: Full Body, Torso-Pierna, PPL, Weider, PHUL, PHAT, 5x5
├─ Biblioteca de ejercicios → Detalle (técnica, errores comunes, músculos, historial, 1RM)
└─ Historial de sesiones → Detalle de sesión

Comer
├─ Diario del día (desayuno, almuerzo, once, cena, colación) ← selector de fecha
├─ Agregar alimento: buscar, escanear, recientes, favoritos, mis comidas, registro rápido
│   └─ Cantidad (porción casera o gramos) con vista previa del día
├─ Crear alimento / receta
├─ Copiar comidas de otro día
├─ Plan semanal → Reemplazar alimento → Lista de compras    ← Etapa 4
└─ Micronutrientes del día                                   ← Etapa 5

Progreso
├─ Peso (pesaje diario + promedio de 7 días + ritmo)
├─ Fuerza (1RM estimado por ejercicio, récords)
├─ Series por músculo en la semana (meta 10–20, alertas)
├─ Medidas corporales                                        ← Etapa 4
├─ Fotos con comparación lado a lado                         ← Etapa 4
└─ Historial de fases

Perfil
├─ Fase actual y objetivos → Nueva fase (tipo, duración, ritmo, vista previa)
├─ Datos personales · Entrenamiento · Alimentación · Comidas del día
├─ Discos y barra (para la calculadora)
├─ Compartir con tu pareja                                   ← por definir
├─ Apariencia (oscuro / claro)
└─ Exportar mis datos · Cerrar sesión
```

---

## 3. Flujos principales

### 3.1 Onboarding (9 pasos, unos 3 minutos)

| Paso | Pantalla | Detalle |
|---|---|---|
| 1 | Crear cuenta | Correo y contraseña; solo se aceptan los correos autorizados |
| 2 | Tus datos | Consentimiento simple: para qué se usan tus datos de salud |
| 3 | Sobre ti | Sexo, fecha de nacimiento, estatura |
| 4 | Peso | Actual, objetivo y % de grasa (opcional, con guía visual) |
| 5 | Actividad | 5 niveles con ejemplos concretos + experiencia en el gimnasio |
| 6 | Objetivo | Volumen / definición / recomposición / mantención + ritmo recomendado **(en el prototipo)** |
| 7 | Entrenamiento | Días (L–D), duración, hora habitual, equipamiento |
| 8 | Alimentación | Tipo de dieta, comidas al día, lo que no te gusta, presupuesto |
| 9 | Tu plan | Cálculo transparente, macros, rutina sugerida y un día de ejemplo **(en el prototipo)** |

**Qué rutina se sugiere:**

| Días | Principiante | Intermedio / avanzado |
|---|---|---|
| 2–3 | Full Body (o 5x5 si hay barra) | Full Body |
| 4 | Torso-Pierna | Torso-Pierna o PHUL |
| 5 | Torso-Pierna + Full Body | PHAT o Weider |
| 6 | PPL con volumen moderado | PPL × 2 |

Si solo hay mancuernas o se entrena en casa, se filtran los ejercicios por el equipamiento disponible.

### 3.2 Un día típico

1. **Mañana:** abres Forus y ves "Hoy toca Pierna A · día alto en carbos". Registras el peso con 2 toques.
2. **Desayuno:** Comer → Desayuno → tus recientes arriba, o "Copiar de ayer".
3. **Almuerzo y once:** los mismos 2 toques por alimento, o escaneas el código de barras.
4. **Gimnasio:** "Empezar entrenamiento" → modo sesión (flujo 3.3).
5. **Post-entreno:** el resumen de la sesión propone una comida que calza con lo que te queda del día → "Registrar en Cena".
6. **Noche:** Inicio muestra si el día quedó cumplido y cómo va la racha.

### 3.3 Modo sesión, la pantalla más importante

1. **Empezar** (1 toque). Funciona igual sin señal: todo se guarda primero en el teléfono.
2. **El ejercicio actual va arriba** con lo que hiciste la última vez y la sugerencia de hoy. Ejemplo: "Hoy 82,5 kg: la última vez completaste 3 × 8 con RIR 2".
3. **Cada serie viene prellenada.** Si la hiciste así, tocas ✓ (1 toque). Si no, tocas el número y lo ajustas con botones grandes (±2,5 kg, ±1 rep). Un cambio de peso se copia a las series siguientes.
4. **Al tocar ✓ parte el descanso** en una barra fija abajo, con −15 s, +15 s y Saltar. Al terminar suena (y vibra en Android). Si la PWA está instalada, llega una notificación con la pantalla bloqueada.
5. **Series especiales:**
   - calentamiento: marcada con "C", no cuenta para el volumen;
   - drop set y rest-pause: se agregan desde la fila;
   - fallida: se marca con una pulsación larga en ✓.
6. **Menú ⋯ del ejercicio:**
   - calculadora de discos (82,5 kg → 25 + 5 + 1,25 por lado);
   - sustituir: propone ejercicios del mismo patrón y músculo con tu equipamiento;
   - ver técnica;
   - nota.
7. **Superseries A1/A2:** al marcar A1 se salta a A2 sin descanso; el descanso corre después de A2.
8. **Al completar un ejercicio** se abre solo el siguiente.
9. **Terminar → Resumen:** duración, volumen, series, récords (con celebración), comparación con la sesión anterior, qué subir la próxima vez y la sugerencia de post-entreno.
10. **Si cierras la app a mitad**, al volver aparece: "Tienes una sesión en curso (Pierna A · 34 min) → Continuar".

### 3.4 Crear o editar una rutina

Plantilla o desde cero → nombre y días.

Por cada día:
1. "+ Ejercicio": biblioteca con filtros por músculo, equipamiento y patrón.
2. Series con un atajo tipo "3 × 8–12 @ RIR 2", descanso y tempo.
3. Arrastrar para reordenar; soltar un ejercicio sobre otro para armar una superserie.

Después, el mesociclo:
- semanas (4 a 8);
- descarga en la última semana;
- progresión de RIR (3 → 2 → 1 → descarga);
- días de la semana en que toca cada día.

**Guardar** genera el calendario y, en la Etapa 4, los objetivos de comida de cada día.

### 3.5 Registrar comida

Comer → "+ Agregar" en la comida → buscador listo para escribir, con tus recientes arriba → escribes "porotos" → aparecen primero tus frecuentes, luego los genéricos y luego las marcas → eliges porción (plato, taza, unidad) o gramos → ves cómo queda tu día → **Agregar**. Vuelves al diario con el aviso "Agregado · Deshacer".

**Atajos:**
- escanear el código de barras;
- copiar una comida de otro día;
- comidas guardadas ("Mi desayuno de siempre");
- **registro rápido** (solo kcal y macros, para cuando comes fuera).

### 3.6 Peso y progreso

- **Registrar peso:** Inicio → Peso → viene cargado el último valor → ±0,1 → Guardar.
- **Progreso:** muestra los puntos diarios, la línea del promedio de 7 días y el ritmo real frente al objetivo.
- **La app no reacciona a un solo pesaje;** solo mira la tendencia.

### 3.7 Revisión semanal (se diseña ahora, se construye en la Etapa 4)

Cada lunes aparece una tarjeta en Inicio. Ejemplo:

> "Tu promedio subió 0,05 kg por semana (objetivo 0,25). Te proponemos +150 kcal, todo en carbohidratos."

Opciones: **[Aplicar] [Esperar una semana más] [¿Por qué?]**.

Si faltaron pesajes o registros, la tarjeta pide primero más constancia en vez de proponer un ajuste.

### 3.8 Nueva fase

Perfil → Fase → "Nueva fase" → tipo, duración y ritmo → vista previa del calendario (kcal promedio por semana y días de pierna, torso y descanso) → Confirmar.

---

## 4. Estados que toda pantalla debe resolver

| Estado | Cómo se ve |
|---|---|
| Vacío (primer uso) | Mensaje corto + la acción principal ("Registra tu primer desayuno") |
| Sin señal | Chip discreto "Sin señal · se guarda en tu teléfono"; nada se bloquea |
| Sincronizando | Ícono pequeño en la cabecera; nunca una pantalla de carga completa |
| Error | Explicación en español simple + reintentar; lo escrito no se pierde |
| Sesión en curso | Barra fija en Inicio y Entrenar para volver a la sesión |

---

## 5. Sistema visual

| Token | Oscuro (por defecto) | Claro |
|---|---|---|
| Fondo | `#0C0C0F` | `#F6F6F8` |
| Superficie / tarjeta | `#16161B` | `#FFFFFF` |
| Texto / secundario | `#F4F4F5` / `#A1A1AA` | `#16161B` / `#55555F` |
| **Naranjo principal** | `#FF6B1A` | `#F26410` |
| Texto sobre naranjo | `#1A0A00` (contraste ≥ 5:1) | `#1A0A00` |
| Proteína | celeste `#38BDF8` | `#0284C7` |
| Carbohidratos | lima `#A3E635` | `#4D7C0F` |
| Grasa | violeta `#C084FC` | `#9333EA` |
| Éxito / alerta / error | `#22C55E` / `#FACC15` / `#F43F5E` | versiones más oscuras |

- **El naranjo se reserva para acciones y calorías.** Cada macro tiene un color propio que no se confunde con él.
- **Tipografía:** Inter para el texto; Barlow Condensed para los números grandes (kg, kcal, temporizador), que caben mejor y se leen de lejos.
- **Componentes base:** tarjeta, anillo de kcal, barra de macro, fila de serie, stepper grande, hoja inferior, aviso con deshacer, chip y gráfico de línea con promedio.
- **Microinteracciones:**
  - vibración corta al marcar una serie (Android);
  - sonido al terminar el descanso;
  - confeti solo con un récord o una meta de fase.

---

## 6. Qué muestra el prototipo y qué no

**Funciona:**
- navegación entre las 10 pantallas;
- objetivo y ritmo del onboarding;
- marcar series con temporizador de descanso real;
- ajustar kg y reps;
- calculadora de discos;
- buscar y agregar alimentos (actualiza los totales);
- agua y peso;
- explicación del objetivo del día;
- registrar el post-entreno;
- modo claro.

**Es ilustrativo:** escáner, foto con IA, editor de rutinas, plan semanal, medidas y fotos. Los valores nutricionales son aproximados y solo sirven de ejemplo.
