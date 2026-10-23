# Evaluación de predicaciones — Iglesia Vida Real

Aplicación privada para el equipo de predicación. React + Vite + TypeScript + Tailwind CSS; backend con Netlify Functions y tres almacenes Netlify Blobs. No requiere Bolt, Supabase, Firebase ni una base de datos externa. Tipografías incluidas en los archivos del sitio, sin servicios de fuentes remotos.

## Desplegar en Netlify

1. Descomprime el proyecto y súbelo a un repositorio de GitHub/GitLab/Bitbucket. No subas `.env` ni PIN reales al repositorio.
2. En Netlify elige **Add new project → Import an existing project**, conecta el repositorio y usa la raíz de este proyecto como directorio base. `netlify.toml` configura `npm run build`, publicación `dist` y funciones `netlify/functions`.
3. En **Project configuration → Environment variables**, configura las variables de abajo. Inclúyelas en el ámbito de **Functions** si Netlify ofrece ámbitos. Usa valores distintos en las vistas previas o desactiva las funciones en esas vistas si no vas a utilizarlas. Nunca antepongas `VITE_` a los secretos.
4. Despliega y abre el dominio HTTPS de Netlify. Los tres almacenes de Blobs se crean automáticamente al escribir datos.
5. Comprueba el acceso con los usuarios configurados, registra un mensaje de prueba y completa dos evaluaciones de compañeros. Solo el predicador debe poder abrir su reporte; el administrador debe ver únicamente los estados desde Administración.

**No basta con arrastrar `dist` al panel de Netlify**: ese método publica el frontend, pero no instala las funciones de esta aplicación. Importa el proyecto completo o usa la CLI:

```sh
npm ci
npm test
npm run build
npx netlify-cli login
npx netlify-cli init
# Configura los secretos desde el panel antes del despliegue de producción.
npx netlify-cli deploy --build --prod
```

No compartas tu cuenta de Netlify con los usuarios configurados: ellos acceden a la aplicación con sus PIN, no al panel de hosting.

## Variables del servidor

- `APP_USERS`: JSON con uno o más participantes, IDs únicos y exactamente un administrador. PIN como cadena numérica de seis caracteres (permite ceros iniciales).
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres. Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` y guárdalo en el panel de Netlify.
- `APP_TIMEZONE`: opcional; por defecto `America/New_York`. Determina el día de cierre de las evaluaciones.

Ejemplo de formato (los nombres y PIN son ficticios; reemplázalos):

```json
[
  { "id": "u1", "nombre": "Participante 1", "pin": "123456", "admin": true },
  { "id": "u2", "nombre": "Participante 2", "pin": "234567", "admin": false },
  { "id": "u3", "nombre": "Participante 3", "pin": "345678", "admin": false },
  { "id": "u4", "nombre": "Participante 4", "pin": "456789", "admin": false }
]
```

Para añadir participantes, agrega nuevas entradas a `APP_USERS` con IDs únicos y `admin: false`, y vuelve a desplegar si Netlify lo requiere. La cantidad de participantes se define en esa configuración.

Conserva los IDs cuando cambies nombres o PIN. Cambiar un usuario invalida sus sesiones existentes; cambiar `JWT_SECRET` invalida todas. La sesión dura 30 días. Cerrar sesión borra la cookie del navegador.

## Desarrollo

```sh
npm ci
npm run dev
```

Vite intenta consultar las funciones. Solo en desarrollo, si la primera consulta de usuarios no encuentra las funciones (error de red, 404, 502 o respuesta HTML), carga `src/demo.ts`: datos ficticios en memoria y un aviso visible. Puedes pulsar **Explorar la demostración sin PIN** o usar cualquier PIN de seis dígitos con un usuario de muestra. Al recargar se pierden estos datos. Un error de configuración JSON/503 del backend real NO activa la demostración; tampoco se activa durante una sesión real. El código de demostración se elimina del bundle de producción.

Para probar con Netlify Functions y Blobs locales, copia `.env.example` a `.env`, reemplaza los ejemplos y ejecuta `npx netlify-cli dev` (o `npm run dev:netlify` si instalaste la CLI). Usa Node 22 o superior. Las cookies mantienen `Secure` y `__Host-` también en desarrollo: prueba con HTTPS o un navegador que admita cookies seguras en localhost; no debilites la cookie en producción.

## Comportamiento y privacidad

- Todos pueden registrar predicaciones; solo el administrador puede editar, eliminar y reabrirlas.
- Se puede evaluar desde el día del mensaje hasta las 23:59:59 del séptimo día posterior, en `APP_TIMEZONE`. No se evalúan mensajes futuros. La reapertura habilita otros siete días para todos los evaluadores de ese mensaje.
- Cada evaluación usa la clave `predicacionId:evaluadorId`. El servidor deriva siempre al evaluador de la cookie y nunca acepta un ID del navegador para elegir una evaluación ajena.
- Login y nombres son los únicos endpoints públicos. Los nombres y roles son visibles antes de entrar; ningún PIN se devuelve ni se incluye en el frontend.
- PIN comparado mediante HMAC de longitud fija y `timingSafeEqual`. Sesión JWT HS256 firmada, cookie HttpOnly + Secure + SameSite=Strict, sin tokens en localStorage. Escrituras limitadas al mismo origen y respuestas privadas con `Cache-Control: no-store`.
- Cinco fallos en una ventana móvil de 15 minutos bloquean a ese usuario. Para evitar pérdidas por solicitudes concurrentes, el almacén `intentos` mantiene cinco plazas con vencimiento: cada intento reserva una plaza mediante `onlyIfNew`/`onlyIfMatch` y consistencia fuerte. Un fallo la ocupa durante 15 minutos; un acierto libera únicamente la plaza que reservó. Las cinco plazas equivalen al contador de fallos y no crecen con el uso.
- Reporte: exige dos evaluaciones externas y que la sesión corresponda al predicador. Devuelve promedios, autoevaluación propia y textos de compañeros mezclados por separado mediante Fisher–Yates y aleatoriedad del servidor; sin IDs, fechas de evaluación ni puntuaciones individuales ajenas.
- Administración solo añade IDs de usuarios que ya completaron, sin comentarios ni puntuaciones. El administrador puede ver su propia evaluación y, cuando él predica, su reporte personal, como cualquier participante.
- Patrones: excluye autoevaluaciones y mensajes con menos de dos evaluaciones externas. Promedia primero por predicación y luego por trimestre, con igual peso por mensaje. Devuelve solo promedios del equipo, cambios frente al trimestre anterior y promedios personales del usuario conectado. No incluye comentarios ni filas individuales.
- Textos de una línea, máximo 180 caracteres; título 140 y pasaje 160. Tiempo entero de 1 a 300 minutos. Las puntuaciones siempre son enteros de 1 a 4. Todo se valida en el servidor.
- Eliminar es una baja lógica: el mensaje desaparece, queda fuera de promedios y sus evaluaciones ya no son accesibles por la aplicación. Los registros quedan retenidos en Blobs; no hay recuperación desde la interfaz. Para una purga definitiva se necesita al propietario de Netlify.
- Para conservar el significado de las evaluaciones no se permite cambiar al predicador después de que haya alguna evaluación. Puedes corregir título, fecha, pasaje y tiempo.

La anonimización elimina la asociación técnica con el evaluador; en un equipo pequeño, el estilo o los detalles de un comentario podrían permitir reconocer a su autor. La interfaz pide evitar nombres y datos identificativos. Quien administra el proyecto Netlify tiene acceso técnico al almacenamiento y a la configuración; los permisos descritos se aplican a los usuarios de la aplicación.

## Imprimir

Abre Mi reporte → **Imprimir o guardar PDF**. Diseño de una página A4, sin menús, con barras y textos. Usa escala 100 %, márgenes predeterminados y desactiva encabezados/pies del navegador. El contenido está acotado para caber; configuraciones de papel o fuente del navegador pueden requerir ajustar la escala.

## Comprobaciones y alcance

`npm test` comprueba privacidad, permisos, autenticación, bloqueo, fechas, validaciones, reapertura, eliminación y agregaciones con un almacén en memoria. `npm run build` verifica TypeScript del frontend y del backend y genera producción. Se revisaron en navegador los flujos de demostración; la conexión con Netlify Blobs y la emisión real de cookies requieren la comprobación final en tu despliegue HTTPS.

El plan Free de Netlify admite Functions y Blobs, sujeto a sus cuotas. En el esquema de créditos consultado el 23/10/2026 incluye 300 créditos al mes y puede pausar proyectos al agotarlos; revisa Usage & billing. Para un equipo pequeño y uso normal el diseño evita servicios de pago, pero no puede garantizar un consumo mensual fijo. Documentación: https://www.netlify.com/pricing/ y https://docs.netlify.com/build/data-and-storage/netlify-blobs/.
