import { env } from './config/env';
import { createApp } from './app';

createApp().listen(env.PORT, () => console.log(`[api] escuchando en :${env.PORT} (IA: ${env.LLM_PROVIDER})`));
