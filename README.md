# LicitaIA Jalisco — MVP (arranque en Docker)

```bash
cp .env.example .env     # ya existe un .env de desarrollo; edítalo si quieres
npm run up               # = docker compose up --build
```

| Servicio | URL |
| --- | --- |
| Web (SPA) | http://localhost:5173 |
| API | http://localhost:3100/api/health |
| S3 simulado (s3mock) | http://localhost:9090 · bucket `licitaia-docs` |
| Postgres | `localhost:5433` (`licitaia` / `licitaia_dev`) |
| Redis | `localhost:6380` |

La IA corre en modo **mock** (`LLM_PROVIDER=mock`): no sale ninguna llamada a internet.

## Usuarios demo (contraseña: valor de `SEED_PASSWORD`, por defecto `Licita2026!`)

| Rol | Correo |
| --- | --- |
| Área requirente | requirente@demo.local |
| Área técnica | tecnico@demo.local |
| Área jurídica | juridico@demo.local |
| Autoridad | autoridad@demo.local |
| Control interno | control@demo.local |
| Administrador | admin@demo.local |

## Flujo completo para probar

**1. Preparar la licitación** (requirente)
Entra como **requirente** → *Nuevo* procedimiento → asistente de 4 pasos. Para que la demo funcione con los archivos de ejemplo, usa estos requisitos obligatorios:
`Memoria RAM de 16 GB` · `Disco SSD de 512 GB` · `Garantía de tres años en sitio`.

**2. Evaluar propuestas** (técnico) — pestañas *Propuestas* y *Matriz*
1. Entra como **técnico** → pestaña **Propuestas** → *Licitante* → registra a dos licitantes.
2. Sube los archivos de [docs/ejemplos-propuestas/](docs/ejemplos-propuestas/):
   - Licitante A: `bajio-ficha-tecnica.pdf` y `bajio-carta-garantia.pdf`
   - Licitante B: `express-propuesta.docx` (dice que *no* incluye SSD ni garantía)
   - Licitante C: `escaner-ilegible.pdf` (sin texto: el sistema avisa que hay que revisarlo a mano)
3. Pestaña **Matriz**: el sistema *sugiere* (borde punteado) y muestra la cita del documento. Tú confirmas: *Confirmar sugeridas como «Cumple»* o abre cada celda para decidir. «No cumple» y «Falta» exigen un motivo.

**3. Generar y aprobar documentos** — pestaña *Documentos*
1. **Matriz comparativa**: solo se genera con todas las celdas confirmadas. Al enviarla a revisión queda **bloqueada**.
2. Revisión: técnico → **jurídico** → **autoridad** (cada uno solo ve sus botones). Un rechazo exige motivo y desbloquea la matriz.
3. **Dictamen técnico**: se habilita cuando el técnico aprobó la matriz. Solvente = cumple *todos* los requisitos obligatorios.
4. Descarga en **Word**, o *Imprimir / PDF* desde el navegador.

**4. Auditoría**: entra como **control interno** → *Bitácora* → verifica la cadena de hashes.

> Qué hace y qué NO hace el sistema: lee PDF/Word y propone coincidencias de palabras; **no entiende negaciones ni decide**. Cada resultado lo confirma una persona.

## Comandos

```bash
npm run logs     # logs de api y web
npm run reset    # baja todo y borra los volúmenes (BD limpia)
npm test         # pruebas unitarias (reglas, workflow, hash, numeroLetra)
```

Estructura y plan completo: [docs/PLAN_MVP.md](docs/PLAN_MVP.md).
