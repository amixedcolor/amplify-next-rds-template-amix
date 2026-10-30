/**
 * Blocks backend — the API your frontend calls via `import { api } from 'aws-blocks'`.
 *
 * Each method of an ApiNamespace becomes a typed RPC endpoint. Runs on Lambda
 * with Aurora Serverless v2 (PostgreSQL) when deployed, and on a local dev
 * server with PGlite (`pnpm blocks:dev`) — same code, no changes.
 *
 * Schema: aws-blocks/migrations/*.sql (+ Kysely types in ./schema.ts)
 * Blocks docs: node_modules/@aws-blocks/blocks/README.md
 * Kysely docs: https://kysely.dev
 */
import { ApiError, ApiNamespace, Database, Scope } from '@aws-blocks/blocks';
import { createKyselyAdapter } from '@aws-blocks/bb-data';
import { sql, type Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';
import { requireUser } from './auth.js';
import { toIsoString, type DB, type TodoTable } from './schema.js';

const scope = new Scope('app');

const database = new Database(scope, 'db', {
  migrationsPath: './aws-blocks/migrations',
  // The default name is derived from the Amplify stack name and easily exceeds
  // PostgreSQL's 63-character limit, so name it explicitly.
  databaseName: 'app',
  // 0 lets Aurora auto-pause when idle (no compute cost), at the price of a
  // cold start of several seconds on the first query. Raise to 0.5+ for production.
  minCapacity: 0,
});

// Type-safe query builder over the Database above. Safe at module scope: it
// connects lazily on the first query (never during CDK synth).
const db = createKyselyAdapter<DB>(database);

/** A todo as returned by the API. */
export interface Todo {
  id: string;
  content: string;
  done: boolean;
  /** ISO 8601 (UTC) */
  created_at: string;
  /** ISO 8601 (UTC) */
  updated_at: string;
}

const todoColumns = ['id', 'content', 'done', 'created_at', 'updated_at'] as const;

function toTodo(row: Pick<Selectable<TodoTable>, (typeof todoColumns)[number]>): Todo {
  return {
    ...row,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

export const api = new ApiNamespace(scope, 'api', (context) => ({
  /** Lists the signed-in user's todos, newest first. */
  async listTodos(): Promise<Todo[]> {
    const user = await requireUser(context);
    const rows = await db
      .selectFrom('todos')
      .select(todoColumns)
      .where('owner', '=', user.sub)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toTodo);
  },

  async createTodo(content: string): Promise<Todo> {
    const user = await requireUser(context);
    const trimmed = content.trim();
    if (!trimmed) throw new ApiError('content is required', 400);

    const row = await db
      .insertInto('todos')
      .values({ id: randomUUID(), owner: user.sub, content: trimmed })
      .returning(todoColumns)
      .executeTakeFirstOrThrow();
    return toTodo(row);
  },

  async setTodoDone(id: string, done: boolean): Promise<Todo> {
    const user = await requireUser(context);
    const row = await db
      .updateTable('todos')
      .set({ done, updated_at: sql<Date>`CURRENT_TIMESTAMP` })
      .where('id', '=', id)
      .where('owner', '=', user.sub)
      .returning(todoColumns)
      .executeTakeFirst();
    if (!row) throw new ApiError('Todo not found', 404);
    return toTodo(row);
  },

  async deleteTodo(id: string) {
    const user = await requireUser(context);
    // Use RETURNING to detect a miss: the Blocks adapter does not report
    // affected-row counts (numDeletedRows is always 0).
    const row = await db
      .deleteFrom('todos')
      .where('id', '=', id)
      .where('owner', '=', user.sub)
      .returning('id')
      .executeTakeFirst();
    if (!row) throw new ApiError('Todo not found', 404);
    return { id };
  },
}));
