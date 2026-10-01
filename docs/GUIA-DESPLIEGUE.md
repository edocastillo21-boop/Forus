# Forus · Guía para ponerla en línea

Tiempo estimado: 20 minutos. Los pasos marcados con **(tú)** requieren tu cuenta o tu contraseña. Claude no los hace por ti.

## 1. Supabase: crear el proyecto (tú)
1. Entra a supabase.com → **New project**.
2. Completa:
   - Nombre: `forus`.
   - Región: **South America (São Paulo)**.
   - Plan: Free (permite 2 proyectos activos; Cuentas Claras usa uno).
3. Guarda la contraseña de la base de datos en tu gestor de contraseñas. La app no la usa y Claude no la necesita.

## 2. Supabase: crear las tablas
En **SQL Editor → New query**, ejecuta en este orden:
1. Todo el contenido de `supabase/migrations/0001_forus.sql`. Crea las 10 tablas, la seguridad por usuario y el registro cerrado.
2. `supabase/local/autorizar-correos.sql`: autoriza tu correo y el de Vanessa. Este archivo no se sube a GitHub.

Resultado esperado: "Success. No rows returned".

## 3. Supabase: datos para la app
En **Project Settings → API**, copia estos dos datos y pásaselos a Claude:
- **Project URL**: `https://<ref>.supabase.co`.
- **Publishable key**: `sb_publishable_...`. Es pública por diseño: la seguridad la dan las reglas de la base.

> Nunca compartas la **secret key** (`sb_secret_...`).

## 4. GitHub: repositorio privado
- **(tú)** Crea un repositorio **privado** llamado `forus`, vacío (sin README).
- Claude sube el código. Si Windows pide autorizar GitHub, acepta en la ventana que aparece.

## 5. Netlify: publicar
1. **(tú)** Entra a Netlify con tu cuenta.
2. Ve a **Add new site → Import an existing project → GitHub** y autoriza el acceso.
3. Elige el repositorio `forus`. La configuración se lee sola desde `netlify.toml`.
4. Pulsa **Deploy**. Opcional: en *Site configuration → Change site name* ponle un nombre, por ejemplo `forus-app`.

Desde ahí, cada cambio que Claude suba a GitHub se publica solo en 1 a 2 minutos.

## 6. Supabase: dirección de la app
En **Authentication → URL Configuration**:
- **Site URL**: la dirección de Netlify, por ejemplo `https://forus-app.netlify.app`.
- **Redirect URLs**: la misma dirección terminada en `/**`.

Así los correos de confirmación y de "olvidé mi contraseña" vuelven a la app.

## 7. Primer ingreso (cada uno en su teléfono)
1. Abre la dirección en Chrome (Android) o Safari (iPhone).
2. Toca **Crear cuenta** una sola vez, con tu correo y una contraseña.
3. Confirma con el enlace del correo. Te deja dentro de la app.
4. Instálala:
   - Android: menú ⋮ → **Instalar app**.
   - iPhone: Compartir → **Agregar a inicio**.
5. Completa el onboarding de 8 pasos.

## Preguntas típicas
- **"Este correo no está autorizado"**: el correo no está en `allowed_emails` (paso 2.2) o tiene otra escritura.
- **Se ve `#access_token=...` en la dirección**: es normal al volver del correo; la app lo limpia sola.
- **Sin señal en el gimnasio**: todo se guarda en el teléfono y se sube al volver la conexión. El chip "Sin señal" solo avisa.
- **¿Vanessa ve mis datos?** No. Cada fila está protegida por usuario en la base de datos, no solo en la app.
