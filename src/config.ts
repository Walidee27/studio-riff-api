import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  valkeyUrl: process.env.VALKEY_URL,
  port: Number(process.env.PORT ?? 3000),
};
