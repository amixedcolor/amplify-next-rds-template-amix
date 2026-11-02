/**
 * Blocks backend — the API your frontend calls via `import { api } from 'aws-blocks'`.
 *
 * Each method of an ApiNamespace becomes a typed RPC endpoint. Runs on Lambda
 * with Aurora Serverless v2 (PostgreSQL) when deployed, and on a local dev
 * server with PGlite (`pnpm blocks:dev`) — same code, no changes.
 *
 * Schema: aws-blocks/migrations/*.sql → `pnpm db:types` → ./db.generated.ts
 * Blocks docs: node_modules/@aws-blocks/blocks/README.md
 * Kysely docs: https://kysely.dev
 */
import { ApiError, ApiNamespace, Database, Scope } from '@aws-blocks/blocks';
import { createKyselyAdapter } from '@aws-blocks/bb-data';
import { sql, type Insertable, type Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';
import { requireUser, type User } from './auth.js';
import type { DB, Todos } from './db.generated.js';
import { toIsoString } from './timestamp.js';
import { requireBoolean, requireText, requireUuid } from './validate.js';

// These identifiers ('app', 'db' and databaseName below) name the AWS resources.
// Changing them after a deploy creates a new, empty Aurora cluster; the old one
// is retained (branch deployments) and keeps billing. Pick names before deploying.
const scope = new Scope('app');

const database = new Database(scope, 'db', {
  migrationsPath: './aws-blocks/migrations',
  // The default name is derived from the Amplify stack name and easily exceeds
  // PostgreSQL's 63-character limit, so name it explicitly.
  databaseName: 'app',
  // 0 lets Aurora auto-pause after ~5 minutes idle (no compute cost). The catch:
  // - The request that wakes it fails with ConnectionFailedException while it
  //   resumes, which can take from several seconds to a few minutes (the
  //   frontend retries automatically; see app/retry-while-db-resumes.ts).
  // - A deploy that runs migrations against a paused cluster can fail even though
  //   Blocks retries for ~2 minutes; re-run the build/sandbox and it succeeds.
  // Raise to 0.5+ for production to keep it always on (billed per ACU-hour).
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

function toTodo(row: Pick<Selectable<Todos>, (typeof todoColumns)[number]>): Todo {
  return {
    ...row,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

/**
 * The signed-in user's todos. Start every todos query here: the owner filter is
 * already applied (and set on insert), so a query can't leak or change another
 * user's rows by forgetting a WHERE clause. (Blocks' Postgres RLS via withRLS()
 * can't be combined with the Kysely adapter, so ownership is enforced here.)
 */
function todosOf(user: User) {
  return {
    selectFrom: () => db.selectFrom('todos').where('owner', '=', user.sub),
    insertInto: (values: Omit<Insertable<Todos>, 'owner'>) =>
      db.insertInto('todos').values({ ...values, owner: user.sub }),
    updateTable: () => db.updateTable('todos').where('owner', '=', user.sub),
    deleteFrom: () => db.deleteFrom('todos').where('owner', '=', user.sub),
  };
}

const MAX_CONTENT_LENGTH = 500;
// Always bound list queries: an RDS Data API response is capped at 1 MiB, so an
// unbounded SELECT that works locally can fail on AWS as a table grows.
// Add pagination (e.g. keyset on created_at) when you need more.
const MAX_LIST_SIZE = 200;

export const api = new ApiNamespace(scope, 'api', (context) => ({
  /** Lists the signed-in user's newest todos (up to MAX_LIST_SIZE). */
  async listTodos(): Promise<Todo[]> {
    const todos = todosOf(await requireUser(context));
    const rows = await todos.selectFrom().select(todoColumns).orderBy('created_at', 'desc').limit(MAX_LIST_SIZE).execute();
    return rows.map(toTodo);
  },

  async createTodo(content: string): Promise<Todo> {
    const todos = todosOf(await requireUser(context));
    const row = await todos
      .insertInto({ id: randomUUID(), content: requireText(content, 'content', MAX_CONTENT_LENGTH) })
      .returning(todoColumns)
      .executeTakeFirstOrThrow();
    return toTodo(row);
  },

  async setTodoDone(id: string, done: boolean): Promise<Todo> {
    const todos = todosOf(await requireUser(context));
    const row = await todos
      .updateTable()
      .set({ done: requireBoolean(done, 'done'), updated_at: sql<Date>`CURRENT_TIMESTAMP` })
      .where('id', '=', requireUuid(id, 'id'))
      .returning(todoColumns)
      .executeTakeFirst();
    if (!row) throw new ApiError('Todo not found', 404);
    return toTodo(row);
  },

  async deleteTodo(id: string) {
    const todos = todosOf(await requireUser(context));
    // Use RETURNING to detect a miss: the Blocks adapter does not report
    // affected-row counts (numDeletedRows is always 0).
    const row = await todos
      .deleteFrom()
      .where('id', '=', requireUuid(id, 'id'))
      .returning('id')
      .executeTakeFirst();
    if (!row) throw new ApiError('Todo not found', 404);
    return { id: row.id };
  },
}));
