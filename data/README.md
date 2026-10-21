# Iteraciones de tesis

`thesis-iterations.json` contiene 19 tableros, 61 apariciones semanales de las 50 tarjetas maestras del Excel `kanban_tesis_modulos_corregidos.xlsx` y ocho tarjetas técnicas adicionales. Una tarjeta maestra puede aparecer en varias semanas; cada aparición es independiente y conserva su identificador de origen.

- Título: Iteración 01 a Iteración 19. Identificador: IT-01 a IT-19.
- Inicio y fin: lunes y domingo de «Iteraciones semanales», sin convertir de zona horaria.
- Objetivo: módulos de las tarjetas trabajadas en esa iteración.
- Tarjetas del Excel: identificador, funcionalidad implementada como nombre y límite/alcance de evidencia como descripción.
- Todas se colocan en «Completada». Las prioridades proceden de las especificaciones del PDF, reasociadas por funcionalidad. No se infieren validación formal, pruebas ni aceptación.
- No se importan requisitos RF/RNF, enlaces ni matrices de capturas a las tarjetas.

## Tarjetas técnicas añadidas tras revisar los repositorios

Estos identificadores TEC son nuevos; no proceden del catálogo del Excel. Las descripciones distinguen estructura, modelado e implementación funcional según el código del corte.

| Iteración | Tarjetas | Evidencia revisada |
| --- | --- | --- |
| IT-01 | TEC-01: inicialización del backend | [5a2ed919](https://github.com/dazidev/tesis-backend/commit/5a2ed919c33721d8c4f47b790bb6bcde1547e9ce): AppModule, main.ts y configuración |
| IT-02 | TEC-02: estructura de módulos; TEC-03: esquema de usuarios | [9c5f2f19](https://github.com/dazidev/tesis-backend/commit/9c5f2f19b50636254b9666eac64d9194e8ab7dd1): módulos con servicios de ejemplo, esquema Prisma y Docker |
| IT-03 | TEC-04: Prisma; TEC-05: registro y login; TEC-06: guardas JWT y roles | [c92eb22c](https://github.com/dazidev/tesis-backend/commit/c92eb22cf6b17972989ba27c2b0f1b354b628e68) y [21d44f1c](https://github.com/dazidev/tesis-backend/commit/21d44f1cf513e9f16ff33f911a74a7efd8012d10) |
| IT-10 | TEC-07: modelado de expedientes; TEC-08: etapas y subetapas | [d67c706b](https://github.com/dazidev/tesis-backend/commit/d67c706b07bcfc7861dffac63d9a82f477d52d83): cambios en prisma/schema.prisma |

## Prioridades del PDF

Se usa la especificación de RF01 (tabla 4.12, página 67 del PDF) y el anexo A para RF02–RF30. El anexo cambia nombres y códigos respecto de las tablas 4.1–4.9: por ejemplo, crear proceso pasa de RF09 a RF12 y crear subetapas de RF19 a RF22. Las asociaciones se hacen por funcionalidad, sin heredar automáticamente los números del Excel.

`thesis-priorities.json` conserva fuera de las tarjetas la trazabilidad entre código de tarjeta, especificaciones, página del PDF, prioridad y carácter provisional. Si hay varias asociaciones, se toma la prioridad más alta. Las tablas RNF carecen de prioridad explícita. El anexo suministrado tampoco incluye especificaciones de carpetas, documentos ni tareas; esas tarjetas y otras sin prioridad aplicable quedan en Media provisional, según el criterio autorizado por el usuario.

Resultado: 27 apariciones de tarjetas con prioridad Alta y 42 con prioridad Media. No se fuerza ninguna tarjeta a Baja: la consulta de invitaciones tiene prioridad Baja, pero comparte tarjeta con la generación de invitaciones, de prioridad Alta. Las asociaciones parciales conservan las limitaciones de alcance originales y no acreditan el cumplimiento íntegro del RF.

## Carga

Ejecutar `yarn db:migrate` y después `yarn db:import-thesis`. Se respalda el contenido existente en `.data/backups/` (excluido de Git) y se importan los 19 tableros en una transacción. Los identificadores estables permiten repetir la carga sin duplicar tableros ni sobrescribir ediciones posteriores. Los tableros anteriores se conservan.
