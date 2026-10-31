# LicitaIA Jalisco — Plan de desarrollo del MVP

> Alcance: Fase 1 del roadmap (sección 4.2 del reporte). Un solo tipo de procedimiento: **licitación pública de bienes y servicios generales**. Duración estimada: **16 semanas (8 sprints de 2 semanas)**.

---

## 1. Principios de diseño

1. **Plantillas primero, IA después.** Los documentos se generan con plantillas deterministas (datos capturados → plantilla → documento). La IA solo redacta secciones narrativas opcionales y siempre con cita de fuente. El MVP funciona aunque la IA esté apagada.
2. **Apoyo, no sustitución.** Todo documento nace como `BORRADOR` y solo la autoridad lo pasa a `AUTORIZADO`. La IA nunca decide si un licitante cumple: eso lo hacen reglas deterministas y personas.
3. **Todo queda en bitácora.** Cada acción relevante escribe un registro de solo adición con encadenamiento de hash.
4. **Una sola fuente de verdad para tipos.** Los esquemas Zod viven en un paquete compartido y los usan tanto el backend (validación) como el frontend (formularios).
5. **UI tipo Apple:** pocas opciones por pantalla, jerarquía tipográfica clara, mucho espacio en blanco, acciones primarias obvias.

---

## 2. Stack tecnológico

| Capa | Tecnología | Motivo |
| --- | --- | --- |
| Monorepo | npm workspaces (`apps/api`, `apps/web`, `packages/shared`) | Tipos compartidos sin publicar paquetes |
| Backend | Node.js 22 LTS + TypeScript + Express 5 | MVC sencillo y conocido |
| ORM / BD | Prisma + PostgreSQL 16 + `pgvector` | Migraciones tipadas; vectores para RAG |
| Validación | Zod (en `packages/shared`) | Mismo esquema en front y back |
| Cola de trabajos | BullMQ + Redis | OCR y generación asíncrona (equivalente a Celery) |
| Plantillas | Handlebars (`.hbs` → HTML) | Una plantilla sirve para vista previa, PDF y Word |
| Exportación | Puppeteer (HTML → PDF) y `html-to-docx` (HTML → DOCX) | Sin mantener dos sistemas de plantillas |
| OCR / extracción | `pdf-parse` (PDF con texto) + `tesseract.js` (escaneados) | Código abierto, sin costo en el MVP |
| IA (opcional) | Claude API vía interfaz `LlmProvider` | Capa de abstracción (riesgo de dependencia, sección 2.4) |
| Auth | Sesión con JWT en cookie `httpOnly`, `argon2`, TOTP con `otplib` | MFA requerida en el MVP |
| Frontend | Vite + React 18 + TypeScript (SPA) | Lo propuesto en la sección 3.1 |
| Estado servidor | TanStack Query | Caché y reintentos sin boilerplate |
| Formularios | React Hook Form + `@hookform/resolvers/zod` | Validación con los esquemas compartidos |
| UI | Tailwind CSS + Radix UI (primitivas accesibles) + Framer Motion | Estética Apple con accesibilidad AA |
| Pruebas | Vitest, Supertest, Playwright, `@axe-core/playwright` | Cobertura ≥ 70 % y criterios WCAG |
| Infra local | Docker Compose (Postgres, Redis, API, Web) | Un solo `docker compose up` |

---

## 3. Estructura del repositorio

```
licitaia/
├── apps/
│   ├── api/                      # Backend MVC
│   │   ├── src/
│   │   │   ├── app.ts            # Express: middlewares y montaje de rutas
│   │   │   ├── server.ts
│   │   │   ├── config/           # env, logger, prisma client
│   │   │   ├── routes/           # Mapea URL → controlador (sin lógica)
│   │   │   ├── controllers/      # C: recibe request, valida, llama servicio, responde
│   │   │   ├── models/           # M: repositorios sobre Prisma + reglas de dominio
│   │   │   ├── services/         # Lógica de negocio (generación, workflow, reglas)
│   │   │   ├── views/            # V: serializers JSON + plantillas .hbs de documentos
│   │   │   │   ├── serializers/
│   │   │   │   └── templates/    # anexo-tecnico.hbs, matriz.hbs, dictamen.hbs
│   │   │   ├── middlewares/      # auth, rbac, audit, errorHandler, rateLimit
│   │   │   ├── jobs/             # workers BullMQ (ocr, generate)
│   │   │   ├── rules/            # reglas deterministas (JSON + evaluador)
│   │   │   └── lib/              # llm/, ocr/, export/, hash/
│   │   ├── prisma/schema.prisma
│   │   └── tests/
│   └── web/                      # SPA
│       └── src/
│           ├── app/              # router, providers, layout
│           ├── features/         # procedimientos, cuestionario, matriz, documentos, bitacora, auth
│           ├── components/ui/    # sistema de diseño (Button, Card, Sheet, ListRow…)
│           ├── lib/              # api client, hooks
│           └── styles/tokens.css
├── packages/shared/              # Esquemas Zod, enums, tipos de DTO
├── docker-compose.yml
└── docs/
```

### 3.1 Cómo se reparte MVC en una API REST

- **Model** (`models/`): un repositorio por entidad (`ProcedimientoModel`, `RequisitoModel`…) que encapsula Prisma y aplica el filtro obligatorio por `dependenciaId`. Ningún controlador toca Prisma directamente.
- **View** (`views/`): dos tipos de vista. Los *serializers* deciden qué campos salen en el JSON (por ejemplo, ocultar precios a roles sin permiso). Las *plantillas Handlebars* son las vistas de los documentos.
- **Controller** (`controllers/`): delgado. Valida con Zod, llama al servicio, devuelve la vista.
- **Services** (`services/`): orquestan modelos, reglas, IA y bitácora. Aquí vive la lógica real, lo que deja los controladores en 10–20 líneas.

Ejemplo del flujo de una petición:

```
POST /api/procedimientos/:id/documentos/anexo-tecnico
  → routes/documentos.routes.ts
  → middlewares: requireAuth → requireRole('REQUIRENTE','TECNICO') → auditContext
  → DocumentosController.generarAnexo(req, res)
      → schema.parse(req.body)
      → DocumentoService.generar('ANEXO_TECNICO', procedimientoId, user)
          → ProcedimientoModel.findCompleto(id, dependenciaId)
          → RulesService.validar(procedimiento)       // alertas
          → TemplateService.render('anexo-tecnico', ctx)
          → DocumentoModel.crearVersion(...)           // estado BORRADOR
          → AuditService.log('DOCUMENTO_GENERADO', ...)
      → documentoSerializer(doc)
```

---

## 4. Generación de documentos con funciones fáciles

La idea es que generar un documento nuevo sea **escribir una plantilla y una función de contexto**, nada más.

### 4.1 Contrato único

```ts
// services/documentos/types.ts
export interface DocumentoDef<Ctx> {
  tipo: TipoDocumento;                       // 'ANEXO_TECNICO' | 'MATRIZ' | 'DICTAMEN'
  plantilla: string;                         // nombre del .hbs
  construirContexto(p: ProcedimientoCompleto): Ctx;
  validar?(ctx: Ctx): Alerta[];              // reglas propias del documento
}
```

### 4.2 API de alto nivel (lo que usan los controladores)

```ts
generarDocumento(tipo, procedimientoId, usuario)  // → Documento (BORRADOR, versión n+1)
previsualizar(documentoId)                        // → HTML
exportar(documentoId, 'pdf' | 'docx')             // → Buffer
compararVersiones(documentoId, vA, vB)            // → diff por sección
```

### 4.3 Helpers de Handlebars

Registrados una sola vez y disponibles en todas las plantillas:

| Helper | Uso en plantilla | Salida |
| --- | --- | --- |
| `fecha` | `{{fecha convocatoria.fechaPublicacion}}` | "31 de octubre de 2026" |
| `moneda` | `{{moneda partida.montoMaximo}}` | "$1,250,000.00 MXN" |
| `numeroLetra` | `{{numeroLetra 15}}` | "quince" |
| `cita` | `{{cita "LCG-JAL" "art. 59"}}` | Nota con fuente y vigencia |
| `estadoCumple` | `{{estadoCumple req.estado}}` | ✓ Cumple / ✗ No cumple / — Falta |
| `seccionIA` | `{{seccionIA justificacion}}` | Texto con marca visible "Generado con IA — revisar" |
| `marcaBorrador` | `{{marcaBorrador}}` | Marca de agua "BORRADOR" hasta que se autoriza |

### 4.4 Documentos del MVP

| Documento | Fuente de datos | IA |
| --- | --- | --- |
| **Anexo técnico** | Respuestas del cuestionario guiado | Opcional: redacción de "descripción del bien/servicio" a partir de viñetas |
| **Matriz comparativa** | Requisitos × propuestas × evaluación (manual o sugerida por extracción) | No. Solo reglas y personas |
| **Dictamen técnico** | Matriz **ya validada** por el área técnica | Opcional: párrafo de justificación por licitante, con cita del requisito |

El proyecto de fallo queda para la Fase 2, como indica el roadmap.

### 4.5 Uso de la IA (acotado)

- Interfaz `LlmProvider.redactar({ instruccion, hechos, fuentes })` que devuelve `{ texto, citas[], sinFuente: boolean }` en JSON estructurado.
- El modelo solo recibe: los hechos capturados y los fragmentos normativos recuperados por pgvector. Los documentos de licitantes **nunca** se pasan como instrucciones (mitigación de inyección, sección 2.4).
- Si `sinFuente` es `true` o una cita no existe en el repositorio normativo, la sección se marca en rojo y no se inserta texto.
- La bitácora guarda modelo, versión, hash del prompt y fuentes usadas.
- Variable `AI_ENABLED=false` desactiva todo; los botones de IA desaparecen de la UI.

---

## 5. Modelo de datos (Prisma, resumen)

```
Dependencia (id, nombre, municipio)
Usuario (id, dependenciaId, nombre, email, passwordHash, mfaSecret, rol, activo)
Procedimiento (id, dependenciaId, folio, titulo, tipo, estado, creadoPor, fechas…)
Partida (id, procedimientoId, descripcion, cantidad, unidad, montoMaximo)
Requisito (id, procedimientoId, categoria[TECNICO|ADMINISTRATIVO|LEGAL],
           descripcion, obligatorio, criterioEvaluacion, fundamentoId?)
Licitante (id, procedimientoId, razonSocial, rfc, rupcVigente?)
Propuesta (id, licitanteId, archivoKey, textoExtraido, confianzaOcr)
Evaluacion (id, requisitoId, licitanteId, estado[CUMPLE|NO_CUMPLE|FALTA|PENDIENTE],
            evidencia, comentario, confirmadoPor?, confirmadoEn?)
Documento (id, procedimientoId, tipo, estado, versionActual)
DocumentoVersion (id, documentoId, version, html, contexto JSON, generadoPor,
                  usoIA JSON?, creadoEn)
Observacion (id, documentoId, seccion, texto, responsableId, estado)
FragmentoNormativo (id, fuente, articulo, texto, vigenteDesde, embedding vector(1024))
Bitacora (id, dependenciaId, usuarioId, accion, entidad, entidadId,
          datos JSON, hashPrevio, hash, creadoEn)   -- solo INSERT
```

- **Aislamiento por dependencia:** todos los repositorios agregan `where: { dependenciaId }`. Como segunda barrera, Row Level Security de Postgres.
- **Bitácora inalterable:** trigger que rechaza `UPDATE`/`DELETE`, y `hash = sha256(hashPrevio + datos)`. Un endpoint de verificación recorre la cadena (métrica 8 de 3.2.1).

---

## 6. Flujo de estados

```
Documento:
BORRADOR ──enviar──▶ EN_REVISION_TECNICA ──aprobar──▶ EN_REVISION_JURIDICA ──aprobar──▶ PENDIENTE_AUTORIZACION ──autorizar──▶ AUTORIZADO
    ▲                       │                                  │                                │
    └──────── rechazar (con observación obligatoria) ──────────┴────────────────────────────────┘
```

- Implementado como una tabla de transiciones en `services/workflow.ts`: `{ desde, hacia, rolesPermitidos, requiereComentario }`. Sin librerías.
- Un documento `AUTORIZADO` es inmutable; cualquier cambio crea una versión nueva en `BORRADOR`.
- **Revisión por secciones:** el revisor marca cada sección como revisada antes de que se habilite "Aprobar". Esto atiende el riesgo de confianza excesiva en la IA.

### Roles (RBAC)

| Rol | Puede |
| --- | --- |
| `REQUIRENTE` | Crear procedimiento, contestar cuestionario, generar anexo técnico |
| `TECNICO` | Cargar propuestas, confirmar extracción, evaluar la matriz, revisión técnica |
| `JURIDICO` | Revisión jurídica, observaciones |
| `AUTORIDAD` | Autorizar o rechazar |
| `CONTROL_INTERNO` | Solo lectura de expedientes y bitácora |
| `ADMIN` | Usuarios y repositorio normativo de su dependencia |

---

## 7. Motor de reglas (alertas)

Reglas declarativas en JSON, escritas y validadas con el equipo de Derecho:

```json
{
  "id": "REQ-001",
  "descripcion": "Todo requisito obligatorio debe tener criterio de evaluación",
  "aplicaA": "requisito",
  "condicion": { "si": { "obligatorio": true }, "entonces": { "noVacio": "criterioEvaluacion" } },
  "severidad": "ERROR",
  "fundamento": "Reglamento LCG Jalisco, art. X"
}
```

Reglas iniciales del MVP:

1. Campos obligatorios de la convocatoria completos.
2. Cada requisito obligatorio tiene criterio de evaluación.
3. Coherencia entre partidas del anexo y requisitos técnicos (toda partida tiene al menos un requisito).
4. Plazos: fechas en orden lógico (publicación < aclaraciones < apertura < fallo).
5. Matriz completa: ninguna celda `PENDIENTE` antes de generar el dictamen.
6. Extracción con confianza < umbral → requiere confirmación humana.
7. Requisito potencialmente restrictivo (marca o modelo específico sin "o equivalente") → advertencia (sección 3.3.2).

El evaluador es una función pura `evaluar(reglas, procedimiento): Alerta[]`, fácil de probar con casos sembrados (métrica 5).

---

## 8. API REST (MVP)

| Método | Ruta | Rol |
| --- | --- | --- |
| POST | `/api/auth/login`, `/api/auth/mfa/verify`, `/api/auth/logout` | público / autenticado |
| GET/POST | `/api/procedimientos` | todos / REQUIRENTE |
| GET/PATCH | `/api/procedimientos/:id` | según estado |
| GET/PUT | `/api/procedimientos/:id/cuestionario/:paso` | REQUIRENTE |
| CRUD | `/api/procedimientos/:id/requisitos` | REQUIRENTE, TECNICO |
| POST | `/api/procedimientos/:id/licitantes/:lid/propuestas` (multipart) | TECNICO |
| GET | `/api/procedimientos/:id/matriz` | TECNICO, JURIDICO, AUTORIDAD |
| PATCH | `/api/evaluaciones/:id` | TECNICO |
| GET | `/api/procedimientos/:id/alertas` | todos |
| POST | `/api/procedimientos/:id/documentos/:tipo` | según tipo |
| GET | `/api/documentos/:id/versiones/:v` · `/preview` · `/export?formato=pdf\|docx` | todos |
| POST | `/api/documentos/:id/transiciones` `{ accion, comentario }` | según workflow |
| POST | `/api/documentos/:id/secciones/:sid/redactar-ia` | REQUIRENTE, TECNICO |
| GET | `/api/bitacora?entidad=&desde=` · `/api/bitacora/verificar` | CONTROL_INTERNO, ADMIN |
| GET | `/api/jobs/:id` | autenticado (estado de OCR o generación) |

Documentada con OpenAPI generado a partir de los esquemas Zod (`zod-to-openapi`).

---

## 9. Frontend: UI tipo Apple

### 9.1 Lenguaje visual

- **Tipografía:** `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif`. Títulos grandes (34 px, peso 700) que se compactan en la barra al hacer scroll.
- **Color:** fondo `#F5F5F7`, tarjetas blancas, acento azul `#0071E3`; verde, rojo y ámbar solo para estados. Modo oscuro con tokens en `tokens.css`.
- **Superficies:** tarjetas con radio 12–16 px, sombras muy suaves, barra lateral y toolbar con `backdrop-filter: blur()` (translucidez).
- **Listas agrupadas** tipo Ajustes de iOS: filas con etiqueta a la izquierda, valor a la derecha y chevron.
- **Movimiento:** transiciones de 200–250 ms con resorte suave (Framer Motion); se respeta `prefers-reduced-motion`.
- **Iconos:** Lucide (trazo fino, parecido a SF Symbols).
- **Contraste y tamaño:** mínimo 4.5:1, objetivos táctiles ≥ 44 px, foco visible (WCAG 2.1 AA).

### 9.2 Layout

```
┌──────────────┬───────────────────────────────────────────────┐
│  LicitaIA    │  ‹ Procedimientos   LPL-012/2026    [Generar] │  ← toolbar translúcida
│              ├───────────────────────────────────────────────┤
│ ▸ Inicio     │  Adquisición de equipo de cómputo             │  ← título grande
│ ▸ Procedim.  │  ● Borrador · 3 alertas                       │
│ ▸ Bitácora   │                                               │
│              │  [ Resumen | Requisitos | Matriz | Documentos ]│  ← control segmentado
│ ──────────── │                                               │
│ Alan V.      │  ┌─ Datos generales ──────────────────────┐   │
│ Técnico      │  │ Tipo            Licitación pública   › │   │
└──────────────┴──┴────────────────────────────────────────┴───┘
```

### 9.3 Pantallas del MVP

1. **Inicio de sesión + MFA:** una tarjeta centrada; código TOTP en 6 casillas.
2. **Inicio:** "Pendientes para ti" (documentos por revisar, alertas, plazos próximos) en tarjetas grandes.
3. **Lista de procedimientos:** búsqueda, filtros por estado como *chips* y filas con indicador de estado.
4. **Cuestionario guiado (asistente):** un tema por pantalla, barra de progreso arriba, "Continuar" fijo abajo, guardado automático, ayuda contextual en un *popover* "¿Por qué se pide esto?" con el fundamento.
   - Pasos: Datos generales → Partidas → Requisitos técnicos → Requisitos administrativos y legales → Criterios de evaluación → Fechas → Resumen.
5. **Expediente:** control segmentado Resumen / Requisitos / Licitantes / Matriz / Documentos / Bitácora.
6. **Carga de propuestas:** zona de arrastrar y soltar; progreso del OCR en tiempo real (sondeo de `/jobs/:id`).
7. **Confirmación de extracción:** vista dividida, documento a la izquierda y campos extraídos a la derecha, con semáforo de confianza; botón "Confirmar todo lo verde".
8. **Matriz comparativa:** tabla con requisitos en filas y licitantes en columnas. Cada celda es ✓ / ✗ / — y abre una *sheet* lateral con evidencia, comentario y fuente.
9. **Editor de borrador:** vista previa fiel del documento, panel derecho con secciones (marcar como revisada), alertas y observaciones; comparación de versiones lado a lado.
10. **Flujo de aprobación:** botón primario contextual ("Enviar a revisión jurídica", "Autorizar"); el rechazo abre una hoja que exige comentario.
11. **Bitácora:** línea de tiempo con filtros y un indicador "Integridad verificada ✓".

### 9.4 Componentes base (`components/ui/`)

`Button`, `IconButton`, `Card`, `GroupedList`/`ListRow`, `SegmentedControl`, `Sheet` (panel lateral), `Dialog`, `Toolbar`, `Sidebar`, `LargeTitle`, `StatusBadge`, `ProgressSteps`, `EmptyState`, `Toast`, `Dropzone`, `ConfidencePill`. Todos sobre Radix para que teclado y lector de pantalla funcionen desde el inicio.

---

## 10. Seguridad en el MVP

| Control | Implementación |
| --- | --- |
| Contraseñas | `argon2id` |
| MFA | TOTP obligatorio para todos los roles |
| Sesión | JWT de vida corta en cookie `httpOnly; Secure; SameSite=Strict` + rotación de refresh token |
| CSRF | Cookie `SameSite=Strict` + encabezado `X-CSRF-Token` |
| Encabezados | `helmet`, CSP estricta en la SPA |
| Límite de peticiones | `express-rate-limit` en login y endpoints de IA |
| Archivos | Solo PDF/DOCX, límite de tamaño, verificación de *magic bytes*, almacenamiento fuera de la raíz web |
| Datos | Cifrado en reposo (volumen y almacenamiento S3-compatible, MinIO en local); TLS en tránsito |
| Aislamiento | Filtro por `dependenciaId` en repositorios + RLS |
| IA | Contenido de licitantes como datos, salida JSON validada con Zod, sin herramientas ni acciones del modelo, sin datos personales en logs |
| Dependencias | `npm audit` y Dependabot en CI |

Revisión con Yael al cierre de cada sprint usando OWASP ASVS nivel 2 y OWASP Top 10 para LLM.

---

## 11. Plan por sprints (16 semanas)

| Sprint | Semanas | Objetivo | Entregable demostrable |
| --- | --- | --- | --- |
| **0** | 1–2 | Base del proyecto | Monorepo, Docker Compose, CI (lint, tipos, pruebas), esquema Prisma inicial, sistema de diseño con 8 componentes base, login con MFA |
| **1** | 3–4 | Procedimientos y cuestionario | CRUD de procedimientos, asistente de 7 pasos con guardado automático, esquemas Zod compartidos, bitácora con hash |
| **2** | 5–6 | Anexo técnico | Servicio de plantillas, helpers, plantilla `anexo-tecnico.hbs` validada por Derecho, vista previa, exportación PDF/DOCX, versiones |
| **3** | 7–8 | Reglas y alertas | Motor de reglas, 7 reglas iniciales, panel de alertas, pruebas con errores sembrados |
| **4** | 9–10 | Propuestas y OCR | Carga de archivos, worker de OCR con BullMQ, confirmación de extracción con nivel de confianza |
| **5** | 11–12 | Matriz y dictamen | Matriz comparativa editable, plantilla de dictamen, flujo de estados completo con roles y revisión por secciones |
| **6** | 13–14 | RAG e IA opcional | Ingesta de Ley y Reglamento por artículo, embeddings en pgvector, `redactar-ia` con citas, marcas de contenido IA |
| **7** | 15–16 | Endurecimiento y Etapa A | Pruebas E2E, auditoría de accesibilidad, revisión de seguridad, carga de 20–30 expedientes públicos del SECG, reporte de métricas |

**Regla de recorte:** si hay retraso, el sprint 6 (IA) se mueve a Fase 2. El MVP sigue siendo útil con plantillas y reglas.

---

## 12. Colaboración del equipo

| Integrante | Entregables para desarrollo | Sprint |
| --- | --- | --- |
| Alfonso (Derecho) | Lista de artículos de la LCG y su Reglamento aplicables al flujo; redacción de reglas en lenguaje natural; texto base del anexo y del dictamen | 1–3 |
| Karla (Derecho) | Aviso de privacidad, textos de consentimiento y avisos en la UI, revisión de qué datos se capturan y cuáles no | 1, 4 |
| Braulio (Negocios) | Mapa del proceso actual, preguntas del cuestionario y su orden, pruebas de usabilidad (SUS) con 5 personas | 0–1, 7 |
| Alan (Software) | Arquitectura, backend, frontend, CI, pruebas | Todos |
| Yael (Ciberseguridad) | Modelo de amenazas, configuración de auth y cifrado, pruebas de seguridad, pruebas de inyección a la IA | 0, 4, 6, 7 |

Las plantillas y reglas viven en el repositorio, en `views/templates/` y `rules/`, para que el equipo de Derecho pueda revisarlas como texto y cada cambio quede en el historial.

---

## 13. Calidad y criterios de "terminado"

Una historia está terminada cuando:

- Tiene pruebas unitarias (servicios y reglas) y de integración (endpoint con Supertest).
- Las pantallas nuevas pasan `axe` sin violaciones AA.
- Las acciones que modifican datos escriben en la bitácora.
- Respeta el aislamiento por dependencia (prueba que intenta leer datos de otra dependencia y espera 404).
- CI en verde: `tsc --noEmit`, ESLint, Vitest con cobertura ≥ 70 %, Playwright en el flujo principal.

### Pruebas clave ligadas a las métricas de 3.2.1

| Métrica | Prueba automatizada |
| --- | --- |
| 1. Exactitud de extracción | Conjunto de 30 PDFs públicos con valores esperados; script compara campo por campo |
| 2 y 7. Citas y salidas sin fuente | Preguntas fuera del repositorio normativo; se espera `sinFuente: true` |
| 3. Requisitos omitidos | Matriz generada vs. matriz de referencia elaborada por Derecho |
| 4. Tiempo de generación | Medición desde la bitácora; prueba de rendimiento con `autocannon` |
| 5. Falsos positivos y negativos | Procedimientos con errores sembrados contra el motor de reglas |
| 8. Integridad de la bitácora | `/api/bitacora/verificar` en CI tras correr la suite E2E |

---

## 14. Primeros pasos (semana 1)

1. `npm init` del monorepo con workspaces y configuración compartida de TypeScript (`tsconfig.base.json`, `strict: true`).
2. `docker-compose.yml` con `postgres:16` (imagen con pgvector), `redis:7` y `minio`.
3. `apps/api`: Express, estructura MVC vacía, `errorHandler`, `GET /health`, Prisma con `Usuario`, `Dependencia` y `Bitacora`.
4. `apps/web`: Vite + React + Tailwind, `tokens.css`, layout con barra lateral, pantalla de login.
5. `packages/shared`: primeros esquemas Zod (`LoginSchema`, `ProcedimientoCreateSchema`).
6. GitHub Actions: instalación, verificación de tipos, lint y pruebas.
7. Pedir a Derecho el texto base del anexo técnico para la semana 4.

---

## 15. Fuera del alcance del MVP

Proyecto de fallo, consulta al RUPC, calendario con notificaciones por correo, SSO (OIDC/SAML), firma electrónica avanzada, otros tipos de procedimiento, integración con SECG y multi-región. Todo queda para la Fase 2 o 3 según el roadmap del reporte.
