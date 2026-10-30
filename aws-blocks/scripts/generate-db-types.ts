/**
 * Generates aws-blocks/db.generated.ts (Kysely table types) from the SQL migrations,
 * so the types can't drift from the schema.
 *
 *   pnpm db:types           regenerate after adding a migration
 *   pnpm db:types --verify  fail if the file is out of date (CI and deploys run this)
 *
 * Applies every migration to a throwaway local PGlite database through the same
 * Blocks Database as the app, then introspects it with kysely-codegen.
 */
import { Database, Scope } from '@aws-blocks/blocks';
import { createKyselyAdapter } from '@aws-blocks/bb-data';
import { generate, PostgresDialect } from 'kysely-codegen';
import { rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const awsBlocksDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(awsBlocksDir, 'db.generated.ts');
const dataDir = '.bb-data/codegen-db'; // Scope 'codegen' + Database 'db'; separate from the dev server's data
const verify = process.argv.includes('--verify');

rmSync(dataDir, { recursive: true, force: true });
const db = createKyselyAdapter<unknown>(
  new Database(new Scope('codegen'), 'db', { migrationsPath: './aws-blocks/migrations' }),
);

try {
  await db.selectNoFrom((eb) => eb.lit(1).as('ready')).execute(); // runs the migrations
  await generate({
    db,
    dialect: new PostgresDialect(),
    outFile,
    verify,
    includePattern: 'public.*',
    excludePattern: 'public._migrations', // Blocks' migration bookkeeping
    // Date/time columns: Date from PGlite, string from the RDS Data API.
    typeMapping: { date: 'DbTimestamp', timestamp: 'DbTimestamp', timestamptz: 'DbTimestamp' },
    customImports: { DbTimestamp: './timestamp.js' },
    typeOnlyImports: true,
  });
  const file = relative(process.cwd(), outFile);
  console.log(verify ? `✅ ${file} is up to date` : `✅ Generated ${file}`);
} catch (error) {
  console.error(
    verify
      ? '❌ aws-blocks/db.generated.ts is out of date. Run `pnpm db:types` and commit the result.'
      : error,
  );
  process.exitCode = 1;
} finally {
  await db.destroy();
  rmSync(dataDir, { recursive: true, force: true });
  // PGlite keeps the event loop alive; exit explicitly.
  process.exit();
}
