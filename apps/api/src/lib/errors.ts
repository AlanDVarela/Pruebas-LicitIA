export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalle?: unknown,
  ) {
    super(message);
  }
}
export const notFound = (what = 'Recurso') => new HttpError(404, `${what} no encontrado`);
export const forbidden = (msg = 'No tienes permiso para esta acción') => new HttpError(403, msg);
