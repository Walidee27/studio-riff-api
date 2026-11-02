import 'dotenv/config';

function deriveTestUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? deriveTestUrl();
