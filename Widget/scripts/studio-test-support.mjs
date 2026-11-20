import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../cloudflare/src/worker.mjs';

class D1StatementMock {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1StatementMock(this.database, this.sql, values);
  }

  first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: result.changes } };
  }
}

class D1Mock {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new D1StatementMock(this.database, sql);
  }

  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

const database = new DatabaseSync(':memory:');
database.exec(fs.readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8'));
const broadcasts = [];
const env = {
  DB: new D1Mock(database),
  ALLOWED_ORIGINS: '*',
  REGISTRATION_ENABLED: 'true',
  DOCK_HUBS: {
    idFromName: name => name,
    get: id => ({
      fetch: async (url, options) => {
        broadcasts.push({ id, url: String(url), body: options?.body || '' });
        return new Response(null, { status: 204 });
      }
    })
  }
};


export {worker,env,database};
