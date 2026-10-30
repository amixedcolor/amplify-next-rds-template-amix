/**
 * Blocks backend — the API your frontend calls via `import { api } from 'aws-blocks'`.
 *
 * Each method of an ApiNamespace becomes a typed RPC endpoint. Runs on Lambda
 * with Aurora Serverless v2 (PostgreSQL) when deployed, and on a local dev
 * server with PGlite (`pnpm blocks:dev`) — same code, no changes.
 *
 * Schema: aws-blocks/migrations/*.sql
 * Blocks docs: node_modules/@aws-blocks/blocks/README.md
 */
import { ApiError, ApiNamespace, Database, Scope, sql } from '@aws-blocks/blocks';
import { randomUUID } from 'node:crypto';
import { requireUser } from './auth.js';

const scope = new Scope('app');

const db = new Database(scope, 'db', {
  migrationsPath: './aws-blocks/migrations',
  // The default name is derived from the Amplify stack name and easily exceeds
  // PostgreSQL's 63-character limit, so name it explicitly.
  databaseName: 'app',
  // 0 lets Aurora auto-pause when idle (no compute cost), at the price of a
  // cold start of several seconds on the first query. Raise to 0.5+ for production.
  minCapacity: 0,
});

export interface Todo {
  id: string;
  content: string;
  done: boolean;
  /** Timestamps reach the client as ISO 8601 strings (JSON-serialized Dates). */
  created_at: string;
  updated_at: string;
}

export const api = new ApiNamespace(scope, 'api', (context) => ({
  /** Lists the signed-in user's todos, newest first. */
  async listTodos() {
    const user = await requireUser(context);
    return db.query<Todo>(
      sql`SELECT id, content, done, created_at, updated_at FROM todos
          WHERE owner = ${user.sub}
          ORDER BY created_at DESC`,
    );
  },

  async createTodo(content: string) {
    const user = await requireUser(context);
    const trimmed = content.trim();
    if (!trimmed) throw new ApiError('content is required', 400);

    return (await db.queryOne<Todo>(
      sql`INSERT INTO todos (id, owner, content)
          VALUES (${randomUUID()}, ${user.sub}, ${trimmed})
          RETURNING id, content, done, created_at, updated_at`,
    ))!;
  },

  async setTodoDone(id: string, done: boolean) {
    const user = await requireUser(context);
    const todo = await db.queryOne<Todo>(
      sql`UPDATE todos SET done = ${done}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND owner = ${user.sub}
          RETURNING id, content, done, created_at, updated_at`,
    );
    if (!todo) throw new ApiError('Todo not found', 404);
    return todo;
  },

  async deleteTodo(id: string) {
    const user = await requireUser(context);
    const { rowCount } = await db.execute(
      sql`DELETE FROM todos WHERE id = ${id} AND owner = ${user.sub}`,
    );
    if (rowCount === 0) throw new ApiError('Todo not found', 404);
    return { id };
  },
}));
