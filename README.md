# Kanba · Tableros para tu tesis

Aplicación de uso personal con **Next.js 16 / App Router, React, TypeScript, PostgreSQL y Prisma 7**. El frontend y los Route Handlers viven en el mismo proyecto Next.js; no requiere un backend separado.

## Incluye

- Varios tableros independientes con iteración, módulo(s) en el objetivo y fechas de inicio y fin. Plantilla con Pendiente, En desarrollo, Completada, Validada, Pruebas y Finalizada, o creación desde una columna vacía.
- Eliminación de tableros desde la papelera en la lista lateral, con confirmación del nombre y de las columnas y tarjetas que se eliminarán.
- Columnas con nombre, ocho colores iniciales y selector de color personalizado. Se pueden reordenar y eliminar. Al eliminar una columna se conservan las tarjetas.
- Tarjetas rectangulares con nombre, descripción y tres prioridades: baja (verde), media (amarillo) y alta (coral). El texto de prioridad acompaña al color.
- Arrastre libre horizontal y vertical, incluso entre columnas y entre filas. La posición exacta se persiste; no se fuerza una cuadrícula.
- Edición con doble clic o con el botón de la tarjeta. Flechas del teclado para mover 5 píxeles; Mayús + flecha para mover 20; Enter para editar.
- Guardado automático con una cola de escrituras y revisiones para detectar cambios concurrentes entre pestañas. Aviso al salir con cambios sin guardar y copia JSON de emergencia si falla el guardado.
- Búsqueda, zoom y ajuste del tablero al ancho disponible.
- Exportación del tablero completo a **PNG y PDF** con título, iteración, módulos, fechas de inicio y fin y leyenda de prioridad. La búsqueda y el zoom no afectan a la exportación. El PDF contiene una imagen en una página del tamaño del tablero, no texto vectorial ni páginas A4 recortadas.

## Ejecutar

Requiere Node.js **22.14 o superior** y Yarn **1.22.22**. Los ejemplos usan credenciales locales de desarrollo.

```sh
yarn install --frozen-lockfile
cp -n .env.example .env
yarn db:generate
```

Inicia PostgreSQL con **una** de estas opciones:

```sh
# Opción A: PostgreSQL local incluido, sin Docker.
# Mantener esta terminal abierta. Datos persistentes en .data/postgres.
yarn db:local
```

```sh
# Opción B: PostgreSQL mediante Docker Compose.
docker compose up -d
```

Ambas opciones usan `127.0.0.1:55432` y la URL de `.env.example`. También puedes configurar `DATABASE_URL` con una instancia PostgreSQL existente. No arranques ambas opciones en el mismo puerto.

Para usar Neon PostgreSQL 15, configura su cadena de conexión en `DATABASE_URL` dentro de tu `.env`. No necesitas iniciar PostgreSQL local ni Docker si utilizas Neon. El archivo `.env` es privado y se excluye de Git y del ZIP; el ejemplo conserva una conexión local sin secretos. Las credenciales no se incluyen en el repositorio.

En otra terminal, desde la carpeta del proyecto:

```sh
yarn db:migrate
yarn db:seed
yarn dev
```

Abrir [http://127.0.0.1:3000](http://127.0.0.1:3000). El seed crea un tablero con tarjetas ilustrativas solamente si la base está vacía. Las tarjetas de ejemplo no representan información real de tu tesis.

Para compilar y ejecutar la versión de producción local:

```sh
yarn build
yarn start
```

## Estructura

```text
src/
  app/
    layout.tsx              # Metadatos, idioma y estilos
    page.tsx                # Entrada de App Router
    globals.css             # Interfaz responsive
    api/boards/route.ts     # Listar y crear tableros
    api/boards/[id]/route.ts # Guardar y eliminar un tablero
  components/workspace.tsx # Interfaz, formularios, lienzo y exportación
  lib/board.ts              # Tipos, validación, plantilla y geometría
  lib/prisma.ts             # Cliente Prisma reutilizado en el servidor
  generated/prisma/         # Generado por Prisma, excluido de Git
prisma/
  schema.prisma
  migrations/               # Migración inicial PostgreSQL
data/thesis-iterations.json  # Datos de las 19 iteraciones extraídos del Excel
scripts/
  local-postgres.mjs         # PostgreSQL local opcional
  seed.ts                   # Tablero ilustrativo
  import-thesis.ts           # Carga idempotente de las 19 iteraciones
```

`Board` tiene sus columnas y tarjetas. Cada tarjeta almacena `x` e `y` en coordenadas del lienzo. Las columnas son regiones visuales; una tarjeta puede cruzar su límite. Los cambios se validan con Zod y se guardan en una transacción. `revision` evita sobrescribir cambios desde otra pestaña.

## Iteraciones de la tesis

Para cargar los 19 tableros del Excel, después de configurar `.env`:

```sh
yarn db:migrate
yarn db:import-thesis
```

Se crean IT-01 a IT-19 con sus fechas semanales, módulos en el objetivo y 69 tarjetas: 61 apariciones de las tarjetas del Excel y ocho tarjetas técnicas respaldadas por commits para las cuatro semanas sin tarjetas asociadas. La carga conserva el tablero anterior, genera un respaldo local y puede repetirse sin duplicar ni sobrescribir tableros ya importados. Consulta `data/README.md` para el origen y los criterios de selección. Las prioridades se contrastaron con las especificaciones del PDF de tesis por funcionalidad: Alta o Media; cuando no existe prioridad documentada se usa Media provisional. La trazabilidad está en `data/thesis-priorities.json`.

Las tarjetas que vuelven a aparecer en una iteración posterior se colocan en «Siguiente iteración» en sus apariciones anteriores. Para revisar tableros ya existentes, usa `yarn db:organize-iterations`; añade `--apply` para aplicar el plan con respaldo, conservando las posiciones ya organizadas y el estado de la última aparición.

## Comprobaciones

```sh
yarn typecheck
yarn test
# Con la aplicación y su base de datos funcionando:
TEST_BASE_URL=http://127.0.0.1:3000 yarn test
```

La prueba de integración crea un tablero temporal, comprueba creación, persistencia de coordenadas, edición de columnas, rechazo de datos inválidos y conflictos de revisión, y lo elimina al terminar. Sin `TEST_BASE_URL`, se omite esa prueba y se ejecutan las pruebas de geometría y validación.

## Notas de uso

- Pensado para uso personal local, sin autenticación ni colaboración multiusuario. El servidor de los scripts `dev` y `start` escucha en loopback. Antes de publicarlo, añade autenticación y autorización por tablero.
- Hasta 20 columnas y 300 tarjetas por tablero; hasta 300 caracteres para el nombre y 2000 para la descripción de cada tarjeta. El lienzo crece verticalmente hasta las tarjetas y permite posicionarlas hasta `y = 10000`.
- PNG se genera a escala 2× en tableros habituales. En tableros muy grandes la escala se ajusta para no superar 32 megapíxeles. Un tablero ancho puede necesitar una página horizontal o una figura ampliada dentro de la tesis.
- Las tarjetas admiten superposición por diseño. Antes de exportar, distribúyelas para que el texto sea visible.
- La interfaz usa DM Sans y Manrope de Google Fonts con fuentes de sistema como alternativa. La exportación usa Arial/Helvetica y no necesita descargar fuentes.
- Los datos se guardan en PostgreSQL, no en localStorage. Si falla la conexión, los cambios pendientes permanecen en memoria de la pestaña: reintenta guardar o descarga la copia JSON antes de cerrar. La copia JSON es un respaldo; esta versión no incluye importación.
- Si tu entorno restringe memoria compartida, PostgreSQL nativo puede no arrancar allí. Ejecuta los comandos en una terminal normal o usa una instancia PostgreSQL externa. La configuración final se verificó con Neon PostgreSQL 15.19 mediante TLS con certificado validado: migración aplicada, plantilla inicial creada y cinco pruebas correctas, incluida la prueba de creación, lectura, edición, conflictos y eliminación de un tablero temporal.

Documentación de referencia: [Next.js App Router](https://nextjs.org/docs/app) y [Prisma con PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).
