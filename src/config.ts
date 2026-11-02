import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function optionalInstant(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (Number.isNaN(new Date(value).getTime())) throw new Error(`${name} n'est pas une date valide : ${value}`);
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  valkeyUrl: process.env.VALKEY_URL,
  port: Number(process.env.PORT ?? 3000),
  fixedNow: optionalInstant('FIXED_NOW'),
};
