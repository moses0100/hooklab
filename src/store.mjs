import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openStore(filename, retention = 200) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL, received_at TEXT NOT NULL, bytes INTEGER NOT NULL,
      kind TEXT NOT NULL, headers TEXT NOT NULL, query TEXT NOT NULL, body TEXT NOT NULL
    );
  `);
  db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run('inbox', randomUUID());
  const inbox = db.prepare('SELECT value FROM settings WHERE key=?').get('inbox').value;
  const insert = db.prepare('INSERT INTO requests(method,received_at,bytes,kind,headers,query,body) VALUES (?,?,?,?,?,?,?)');
  const prune = db.prepare('DELETE FROM requests WHERE id NOT IN (SELECT id FROM requests ORDER BY id DESC LIMIT ?)');
  return {
    inbox,
    save(record) {
      db.exec('BEGIN');
      try {
        const result = insert.run(record.method, record.receivedAt, record.bytes, record.kind,
          JSON.stringify(record.headers), JSON.stringify(record.query), JSON.stringify(record.body));
        prune.run(retention);
        db.exec('COMMIT');
        return Number(result.lastInsertRowid);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    list() { return db.prepare('SELECT id,method,received_at AS receivedAt,bytes,kind FROM requests ORDER BY id DESC').all(); },
    get(id) {
      const row = db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      return row ? { id: row.id, method: row.method, receivedAt: row.received_at, bytes: row.bytes,
        kind: row.kind, headers: JSON.parse(row.headers), query: JSON.parse(row.query), body: JSON.parse(row.body) } : null;
    },
    close() { db.close(); }
  };
}
