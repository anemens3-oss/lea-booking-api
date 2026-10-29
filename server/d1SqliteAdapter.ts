import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { D1Database, D1PreparedStatement, D1Result } from '../worker/types';

/**
 * Адаптер Cloudflare D1 поверх встроенного движка SQLite (node:sqlite DatabaseSync).
 * Позволяет запускать точно тот же код Cloudflare Worker и миграцию migrations/0001_init.sql
 * локально и в автоматических тестах без внешних бинарных зависимостей.
 */
class SqliteD1PreparedStatement implements D1PreparedStatement {
  private db: DatabaseSync;
  private query: string;
  private boundValues: unknown[];

  constructor(db: DatabaseSync, query: string, boundValues: unknown[] = []) {
    this.db = db;
    this.query = query;
    this.boundValues = boundValues;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.db, this.query, values);
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.query);
    const row = stmt.get(...(this.boundValues as (string | number | bigint | Uint8Array | null)[])) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    if (colName) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async run(): Promise<D1Result> {
    const stmt = this.db.prepare(this.query);
    const info = stmt.run(
      ...(this.boundValues as (string | number | bigint | Uint8Array | null)[])
    );
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.query);
    const rows = stmt.all(
      ...(this.boundValues as (string | number | bigint | Uint8Array | null)[])
    ) as T[];
    return {
      results: rows,
      success: true,
      meta: {
        changes: 0,
      },
    };
  }
}

export class LocalSqliteD1Database implements D1Database {
  private db: DatabaseSync;

  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
  }

  prepare(query: string): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.db, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (const stmt of statements) {
        const res = await stmt.run();
        results.push(res as D1Result<T>);
      }
      this.db.exec('COMMIT');
      return results;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const start = Date.now();
    this.db.exec(query);
    return {
      count: 1,
      duration: Date.now() - start,
    };
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Создаёт экземпляр локальной D1-совместимой базы данных и накатывает migrations/0001_init.sql
 */
export function createInitializedD1Database(dbPath = ':memory:'): LocalSqliteD1Database {
  const d1 = new LocalSqliteD1Database(dbPath);
  const migrationPath = path.resolve(process.cwd(), 'migrations/0001_init.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  d1.exec(sql);
  return d1;
}
