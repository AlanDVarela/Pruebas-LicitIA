import { z } from 'zod';

// ───────── Enumeraciones ─────────
export const ROLES = ['REQUIRENTE', 'TECNICO', 'JURIDICO', 'AUTORIDAD', 'CONTROL_INTERNO', 'ADMIN'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS_DOCUMENTO = ['ANEXO_TECNICO', 'MATRIZ', 'DICTAMEN'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const ESTADOS_DOCUMENTO = [
  'BORRADOR',
  'EN_REVISION_TECNICA',
  'EN_REVISION_JURIDICA',
  'PENDIENTE_AUTORIZACION',
  'AUTORIZADO',
] as const;
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

export const ACCIONES_WORKFLOW = [
  'ENVIAR_A_REVISION_TECNICA',
  'APROBAR_TECNICA',
  'APROBAR_JURIDICA',
  'AUTORIZAR',
  'RECHAZAR',
] as const;
export type AccionWorkflow = (typeof ACCIONES_WORKFLOW)[number];

export const TIPO_PROCEDIMIENTO = 'LICITACION_PUBLICA_BIENES_SERVICIOS' as const;

// ───────── Auth ─────────
export const LoginSchema = z.object({
  email: z.string().email('Correo no válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ───────── Procedimiento ─────────
export const ProcedimientoCreateSchema = z.object({
  titulo: z.string().trim().min(5, 'Mínimo 5 caracteres').max(200),
});
export type ProcedimientoCreateInput = z.infer<typeof ProcedimientoCreateSchema>;

// ───────── Cuestionario guiado (un esquema por paso) ─────────
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD');

export const GeneralesSchema = z.object({
  objeto: z.string().trim().min(10, 'Describe el objeto de la contratación (mínimo 10 caracteres)'),
  areaRequirente: z.string().trim().min(2, 'Indica el área requirente'),
  justificacion: z.string().trim().min(10, 'Explica brevemente por qué se requiere'),
});

export const PartidaSchema = z.object({
  descripcion: z.string().trim().min(3, 'Describe la partida'),
  cantidad: z.coerce.number().positive('Debe ser mayor a 0'),
  unidad: z.string().trim().min(1, 'Indica la unidad'),
  montoMaximo: z.coerce.number().nonnegative('No puede ser negativo'),
});
export const PartidasSchema = z.object({
  partidas: z.array(PartidaSchema).min(1, 'Agrega al menos una partida'),
});

export const CATEGORIAS_REQUISITO = ['TECNICO', 'ADMINISTRATIVO', 'LEGAL'] as const;
export const RequisitoSchema = z.object({
  /** Lo asigna el servidor; permite que la matriz sobreviva a reordenar o editar requisitos. */
  id: z.string().optional(),
  categoria: z.enum(CATEGORIAS_REQUISITO),
  descripcion: z.string().trim().min(3, 'Describe el requisito'),
  obligatorio: z.boolean(),
  criterioEvaluacion: z.string().trim(),
});
export const RequisitosSchema = z.object({
  requisitos: z.array(RequisitoSchema).min(1, 'Agrega al menos un requisito'),
});

export const FechasSchema = z.object({
  fechas: z.object({
    publicacion: fecha,
    aclaraciones: fecha,
    apertura: fecha,
    fallo: fecha,
  }),
});

export const PASOS = ['generales', 'partidas', 'requisitos', 'fechas'] as const;
export type Paso = (typeof PASOS)[number];

export const PASO_SCHEMAS = {
  generales: z.object({ generales: GeneralesSchema }),
  partidas: PartidasSchema,
  requisitos: RequisitosSchema,
  fechas: FechasSchema,
} as const;

export type Partida = z.infer<typeof PartidaSchema>;
export type Requisito = z.infer<typeof RequisitoSchema>;
export type DatosProcedimiento = Partial<
  z.infer<(typeof PASO_SCHEMAS)['generales']> &
    z.infer<typeof PartidasSchema> &
    z.infer<typeof RequisitosSchema> &
    z.infer<typeof FechasSchema>
>;

// ───────── Alertas ─────────
export type Severidad = 'ERROR' | 'ADVERTENCIA';
export interface Alerta {
  reglaId: string;
  severidad: Severidad;
  mensaje: string;
  fundamento: string | null;
}

// ───────── Workflow ─────────
export const TransicionSchema = z.object({
  accion: z.enum(ACCIONES_WORKFLOW),
  comentario: z.string().trim().max(2000).optional(),
});

// ───────── IA ─────────
export const RedactarSchema = z.object({
  instruccion: z.string().trim().min(5).max(500),
  hechos: z.record(z.unknown()).default({}),
});

// ───── Licitantes, propuestas y matriz ─────
export const ESTADOS_EVALUACION = ['PENDIENTE', 'CUMPLE', 'NO_CUMPLE', 'FALTA'] as const;
export type EstadoEvaluacion = (typeof ESTADOS_EVALUACION)[number];

export const LicitanteCreateSchema = z.object({
  razonSocial: z.string().trim().min(3, 'Escribe la razón social (mínimo 3 caracteres)').max(200),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})?$/, 'RFC no válido (12 o 13 caracteres)')
    .optional(),
});

export const CeldaUpdateSchema = z.object({
  requisitoId: z.string().min(1),
  licitanteId: z.string().min(1),
  estado: z.enum(['CUMPLE', 'NO_CUMPLE', 'FALTA']),
  comentario: z.string().trim().max(1000).optional(),
});
