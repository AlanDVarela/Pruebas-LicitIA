import type { Request, Response } from 'express';
import { LoginSchema } from '@licitaia/shared';
import { env } from '../config/env';
import { parse } from '../middlewares/validate';
import { COOKIE } from '../middlewares/auth';
import { AuthService } from '../services/AuthService';

export const AuthController = {
  async login(req: Request, res: Response) {
    const { email, password } = parse(LoginSchema, req.body);
    const { token, usuario } = await AuthService.login(email, password);
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: env.COOKIE_SECURE, maxAge: 8 * 3600_000 });
    res.json({ usuario });
  },
  logout(_req: Request, res: Response) {
    res.clearCookie(COOKIE);
    res.status(204).end();
  },
  me(req: Request, res: Response) {
    res.json({ usuario: req.user, aiEnabled: env.AI_ENABLED });
  },
};
