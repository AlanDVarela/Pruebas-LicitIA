import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../lib/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, detalle: err.detalle });
    return;
  }
  if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'El archivo supera el límite de 10 MB' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado' });
};
