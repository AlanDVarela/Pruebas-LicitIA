import { PrismaClient, type Rol } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();
const password = process.env.SEED_PASSWORD ?? 'Licita2026!';

const USUARIOS: { nombre: string; email: string; rol: Rol }[] = [
  { nombre: 'Rosa Requirente', email: 'requirente@demo.local', rol: 'REQUIRENTE' },
  { nombre: 'Tomás Técnico', email: 'tecnico@demo.local', rol: 'TECNICO' },
  { nombre: 'Julia Jurídico', email: 'juridico@demo.local', rol: 'JURIDICO' },
  { nombre: 'Aurelio Autoridad', email: 'autoridad@demo.local', rol: 'AUTORIDAD' },
  { nombre: 'Carmen Control', email: 'control@demo.local', rol: 'CONTROL_INTERNO' },
  { nombre: 'Admin Demo', email: 'admin@demo.local', rol: 'ADMIN' },
];

async function main() {
  const dep =
    (await prisma.dependencia.findFirst({ where: { nombre: 'Dependencia Demo' } })) ??
    (await prisma.dependencia.create({ data: { nombre: 'Dependencia Demo', municipio: 'Guadalajara' } }));

  const passwordHash = await hash(password);
  for (const u of USUARIOS) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, dependenciaId: dep.id },
    });
  }
  console.log(`[seed] dependencia "${dep.nombre}" y ${USUARIOS.length} usuarios listos`);
}

main().finally(() => prisma.$disconnect());
