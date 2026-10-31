import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { AuthController } from '../controllers/AuthController';
import { BitacoraController } from '../controllers/BitacoraController';
import { DocumentosController } from '../controllers/DocumentosController';
import { MatrizController } from '../controllers/MatrizController';
import { IaController } from '../controllers/IaController';
import { ProcedimientosController } from '../controllers/ProcedimientosController';
import { requireAuth, requireRole } from '../middlewares/auth';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));

// Auth
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
routes.post('/auth/login', loginLimiter, AuthController.login);
routes.post('/auth/logout', AuthController.logout);
routes.get('/auth/me', requireAuth, AuthController.me);

// Todo lo demás requiere sesión
routes.use(requireAuth);

routes.get('/procedimientos', ProcedimientosController.list);
routes.post('/procedimientos', requireRole('REQUIRENTE'), ProcedimientosController.create);
routes.get('/procedimientos/:id', ProcedimientosController.get);
routes.put('/procedimientos/:id/cuestionario/:paso', requireRole('REQUIRENTE'), ProcedimientosController.guardarPaso);
routes.get('/procedimientos/:id/alertas', ProcedimientosController.alertas);
routes.post('/procedimientos/:id/documentos/:tipo', requireRole('REQUIRENTE', 'TECNICO'), DocumentosController.generar);

// Evaluación de propuestas (área técnica)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
routes.get('/procedimientos/:id/matriz', MatrizController.get);
routes.post('/procedimientos/:id/licitantes', requireRole('TECNICO'), MatrizController.agregarLicitante);
routes.post('/licitantes/:id/propuestas', requireRole('TECNICO'), upload.single('archivo'), MatrizController.subirPropuesta);
routes.get('/propuestas/:id/archivo', MatrizController.descargar);
routes.put('/procedimientos/:id/matriz/celdas', requireRole('TECNICO'), MatrizController.actualizarCelda);
routes.post('/procedimientos/:id/matriz/confirmar-sugerencias', requireRole('TECNICO'), MatrizController.confirmarSugerencias);

routes.get('/documentos/:id', DocumentosController.get);
routes.get('/documentos/:id/exportar', DocumentosController.exportar);
routes.get('/documentos/:id/preview', DocumentosController.preview);
routes.post('/documentos/:id/transiciones', DocumentosController.transicion); // el rol se valida en WorkflowService

routes.post('/ia/redactar', requireRole('REQUIRENTE', 'TECNICO'), IaController.redactar);

routes.get('/bitacora', requireRole('CONTROL_INTERNO'), BitacoraController.list);
routes.get('/bitacora/verificar', requireRole('CONTROL_INTERNO'), BitacoraController.verificar);
