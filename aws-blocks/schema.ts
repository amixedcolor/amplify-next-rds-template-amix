/**
 * Kysely table types. Keep these in sync with aws-blocks/migrations/*.sql —
 * the migrations are the source of truth; these only type the query builder.
 *
 * ColumnType<Select, Insert, Update>: `never` marks a column as not writable.
 * Generated<T>: has a database default, so optional on insert.
 * @see https://kysely.dev/docs/getting-started#types
 */
import type { ColumnType, Generated } from 'kysely';

/**
 * Timestamps come back as `Date` from PGlite (local) but as a string such as
 * '2026-01-01 12:00:00.000' (UTC, no offset) from the RDS Data API (AWS).
 * Normalize with toIsoString() before returning them from the API.
 */
type Timestamp = ColumnType<Date | string, never, Date | string>;

export interface TodoTable {
  id: string;
  owner: string;
  content: string;
  done: Generated<boolean>;
  created_at: ColumnType<Date | string, never, never>;
  updated_at: Timestamp;
}

export interface DB {
  todos: TodoTable;
}

/** Converts a timestamp from either engine to an ISO 8601 string (UTC). */
export function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  let iso = value.replace(' ', 'T');
  if (/[+-]\d{2}$/.test(iso)) iso += ':00'; // '+09' -> '+09:00'
  else if (!/(Z|[+-]\d{2}:\d{2})$/.test(iso)) iso += 'Z'; // no offset -> UTC
  return new Date(iso).toISOString();
}
