# Grupo París — Tablero contable
Prototipo funcional privado, con cuatro empresas provisionales, filtros globales, tablero y lista, creación de tareas y checklist, agenda y análisis por empleado/equipo/sector. Sin dependencias de ejecución. Servir public/ mediante HTTP.

Los datos de demostración se guardan en localStorage por navegador. No existen autenticación de empleados, permisos backend ni sincronización multiusuario. La vista de jefe es de demostración. No cargar datos productivos hasta implementar Supabase Auth, RLS, migraciones y auditoría conforme al documento de requisitos. El acceso privado de Sites no reemplaza permisos del producto.

Las empresas y personas son ejemplos editables en public/app.js. Cada tarea posee ID y empresa independientes. No se deduplica por título o banco. Los porcentajes usan solamente tareas filtradas. Los equipos de ejemplo agrupan cuatro empleados. El período inicial es septiembre 2026.

Se realizó una revisión inicial del legacy en modo lectura; ver docs/architecture/LEGACY-REVIEW.md. No constituye una auditoría completa ni la reconstrucción integral. Se incorporaron el SVG oficial y la identidad monocroma.
