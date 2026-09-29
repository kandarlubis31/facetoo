import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';

const DB_PATH = resolve(__dirname, 'test.db');
const SCHEMA_PATH = resolve(__dirname, '../../packages/database/prisma/schema.test.prisma');
const PRISMA_BIN = resolve(__dirname, '../../packages/database/node_modules/.bin/prisma');

export default function setup() {
  // Clean old db
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
  }

  // Generate Prisma client once
  execSync(`"${PRISMA_BIN}" generate --schema="${SCHEMA_PATH}"`, {
    cwd: resolve(__dirname, '../..'),
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  });

  // Push schema to SQLite
  execSync(`"${PRISMA_BIN}" db push --schema="${SCHEMA_PATH}" --skip-generate --accept-data-loss`, {
    cwd: resolve(__dirname, '../..'),
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  });
}
