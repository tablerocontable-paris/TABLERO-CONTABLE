# Copia portable del laboratorio — 07/10/2026

## Alcance

Permitir guardar la simulación ficticia local y trasladarla manualmente a otro
navegador o PC antes de crear cuentas. La función trabaja sólo con
`paris-state-lab`; no lee ni escribe la clave operativa, no llama a `/api` y no
incluye credenciales.

## Formato y aceptación

- JSON con `format: grupo-paris-lab-backup`, `formatVersion: 1`, fecha de creación
  y el estado completo de laboratorio en `state`.
- La lectura limita el archivo a 10 MB y valida el envelope, la versión, el
  esquema de estado vigente y que el perfil activo exista.
- Antes de importar se muestra el nombre del archivo y cantidades de perfiles,
  empresas, tareas y notas/comentarios. La persona confirma el reemplazo con una
  casilla explícita.
- Una copia inválida o incompatible no cambia almacenamiento. Una copia válida
  se escribe en `paris-state-lab` y recarga la vista; `paris-state-v3` y el
  selector de entorno quedan intactos.
- La copia es JSON sin cifrar y puede contener anotaciones y comentarios. Debe
  guardarse en un lugar privado; la simulación actual usa nombres y datos
  ficticios.

## Límites

Esto transporta únicamente estado local de laboratorio. No sincroniza PCs,
respalda el sitio publicado, Git, D1 o Supabase y no prueba recuperación de una
base productiva. Esos controles permanecen en `docs/ops/FINAL-ACCEPTANCE.md`.
No se importan archivos o perfiles al espacio operativo.

## Evidencia

Pruebas unitarias y recorrido Edge de descarga, validación, confirmación y
restauración en
`docs/architecture/review-evidence/laboratory-backup-lab-20261007.json`.

## Actualización de alcance verificada — 11/10/2026

El contrato anterior documenta el corte inicial v1. La fuente vigente genera
copias v2 con archivos de evidencia y acepta v1 para compatibilidad. V1 tiene
límite de 10 MB y no transporta evidencia; v2 limita el JSON completo a 50 MB,
incluido el contenido codificado en base64. Cada imagen admite hasta 5 MB y
cada PDF hasta 10 MB. Restaurar v2 exige la ruta asíncrona de evidencia y estado;
la inspección de referencias no demuestra restauración completa.

Fuentes: src/data/repository.ts, src/data/laboratoryEvidence.ts y
src/components/LaboratoryBackup.tsx. Auditoría e incidencias pendientes:
docs/architecture/SOL-AUDIT-20261008.md (S03, S09 y S11). No se declara aceptada
la recuperación frente a cuota insuficiente, referencias semánticas inválidas
o competencia entre archivos por actualizar esta documentación.
