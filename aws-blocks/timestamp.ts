/**
 * Timestamp handling shared by the generated DB types (./db.generated.ts) and the API.
 *
 * Timestamps come back as `Date` from PGlite (local) but as a string such as
 * '2026-01-01 12:00:00.000' (UTC, no offset) from the RDS Data API (AWS).
 *
 * Writing or comparing: the Data API sends every JS string/Date parameter as text
 * (no type hint), so PostgreSQL rejects it against a timestamp column on AWS even
 * though PGlite accepts it. Cast explicitly, e.g.
 *   .where('created_at', '>', sql<Date>`${since}::timestamptz`)
 *   .set({ due_at: sql<Date>`${value}::timestamptz` })
 * or let the database fill it (DEFAULT CURRENT_TIMESTAMP / sql`CURRENT_TIMESTAMP`).
 * The same applies to uuid, json/jsonb, numeric and date columns.
 */
import type { ColumnType } from 'kysely';

/** Kysely column type for date / timestamp / timestamptz columns (see scripts/generate-db-types.ts). */
export type DbTimestamp = ColumnType<Date | string, Date | string, Date | string>;

/** Converts a timestamp from either engine to an ISO 8601 string (UTC). */
export function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  let iso = value.replace(' ', 'T');
  if (/[+-]\d{2}$/.test(iso)) iso += ':00'; // '+09' -> '+09:00'
  else if (!/(Z|[+-]\d{2}:\d{2})$/.test(iso)) iso += 'Z'; // no offset -> UTC
  return new Date(iso).toISOString();
}
