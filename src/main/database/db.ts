import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { getDataDir } from '../config/data-dir';

let db: SqlJsDatabase | null = null;

/**
 * 获取数据库文件路径
 */
function getDbPath(): string {
  return path.join(getDataDir(), 'wallpaper.db');
}

/**
 * 初始化数据库连接并创建表
 * 使用 sql.js（纯 JS/WASM 实现，无需原生编译）
 */
export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs({
    // 使用 CDN 加载 WASM 文件（开发环境）
    locateFile: (file: string) => {
      return path.join(__dirname, '../../node_modules/sql.js/dist/', file);
    },
  });

  const dbPath = getDbPath();
  console.log(`[Database] Opening database at: ${dbPath}`);

  // 如果数据库文件存在，加载它
  let newDb: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    newDb = new SQL.Database(fileBuffer);
    console.log('[Database] Loaded existing database');
  } else {
    newDb = new SQL.Database();
    console.log('[Database] Created new database');
  }
  db = newDb;

  // ─── 迁移：旧表 CHECK(type IN ('image','html')) → 支持 'video' ───
  const wpTables = newDb.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='wallpapers'");
  const needsMigration = wpTables.length > 0 && wpTables[0].values.length > 0 && (() => {
    const createSQL = String(wpTables[0].values[0][0] || '');
    // 旧约束: CHECK(type IN ('image', 'html')) 不含 video
    return createSQL.includes("'html'") && !createSQL.includes("'video'");
  })();

  if (needsMigration) {
    console.log('[Database] Migrating wallpapers table to support video type...');
    newDb.run('ALTER TABLE wallpapers RENAME TO wallpapers_old');
    newDb.run(`
      CREATE TABLE wallpapers (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        type          TEXT NOT NULL CHECK(type IN ('image', 'html', 'video')),
        filePath      TEXT NOT NULL,
        thumbnailPath TEXT,
        resolution    TEXT,
        duration      INTEGER,
        tags          TEXT DEFAULT '[]',
        isFavorite    INTEGER DEFAULT 0,
        isAIGenerated INTEGER DEFAULT 0,
        createdAt     TEXT DEFAULT (datetime('now', 'localtime')),
        lastUsedAt    TEXT
      )
    `);
    newDb.run(`
      INSERT INTO wallpapers (id, name, type, filePath, thumbnailPath, resolution, tags, isFavorite, isAIGenerated, createdAt, lastUsedAt)
      SELECT id, name, type, filePath, thumbnailPath, resolution, tags, isFavorite, isAIGenerated, createdAt, lastUsedAt
      FROM wallpapers_old
    `);
    newDb.run('DROP TABLE wallpapers_old');
    newDb.run('CREATE INDEX IF NOT EXISTS idx_wallpapers_type ON wallpapers(type)');
    newDb.run('CREATE INDEX IF NOT EXISTS idx_wallpapers_favorite ON wallpapers(isFavorite)');
    newDb.run('CREATE INDEX IF NOT EXISTS idx_wallpapers_created ON wallpapers(createdAt DESC)');
    saveDatabase();
    console.log('[Database] Migration complete');
  }

  // 补充 duration 列（如果缺失）
  if (!needsMigration) {
    const infoResult = newDb.exec("PRAGMA table_info(wallpapers)");
    if (infoResult.length > 0) {
      const cols = infoResult[0].values as unknown[][];
      const hasDuration = cols.some((c: unknown[]) => c[1] === 'duration');
      if (!hasDuration) {
        newDb.run('ALTER TABLE wallpapers ADD COLUMN duration INTEGER');
        saveDatabase();
        console.log('[Database] Added duration column');
      }
    }
  }

  // 创建表（新库直接使用新 schema）
  newDb.run(`
    CREATE TABLE IF NOT EXISTS wallpapers (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL CHECK(type IN ('image', 'html', 'video')),
      filePath      TEXT NOT NULL,
      thumbnailPath TEXT,
      resolution    TEXT,
      duration      INTEGER,
      tags          TEXT DEFAULT '[]',
      isFavorite    INTEGER DEFAULT 0,
      isAIGenerated INTEGER DEFAULT 0,
      createdAt     TEXT DEFAULT (datetime('now', 'localtime')),
      lastUsedAt    TEXT
    )
  `);

  newDb.run(`
    CREATE TABLE IF NOT EXISTS ai_generations (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL CHECK(type IN ('image', 'html')),
      prompt        TEXT NOT NULL,
      providerId    TEXT NOT NULL,
      model         TEXT,
      resultPath    TEXT,
      wallpaperId   TEXT REFERENCES wallpapers(id),
      status        TEXT NOT NULL DEFAULT 'pending',
      errorMessage  TEXT,
      createdAt     TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 创建索引
  newDb.run(`CREATE INDEX IF NOT EXISTS idx_wallpapers_type ON wallpapers(type)`);
  newDb.run(`CREATE INDEX IF NOT EXISTS idx_wallpapers_favorite ON wallpapers(isFavorite)`);
  newDb.run(`CREATE INDEX IF NOT EXISTS idx_wallpapers_created ON wallpapers(createdAt DESC)`);
  newDb.run(`CREATE INDEX IF NOT EXISTS idx_generations_wallpaper ON ai_generations(wallpaperId)`);
  newDb.run(`CREATE INDEX IF NOT EXISTS idx_generations_status ON ai_generations(status)`);
  newDb.run(`CREATE INDEX IF NOT EXISTS idx_generations_created ON ai_generations(createdAt DESC)`);

  // 保存数据库
  saveDatabase();

  console.log('[Database] Tables initialized');
  return newDb;
}

/**
 * 保存数据库到磁盘
 */
export function saveDatabase(): void {
  if (!db) return;
  const dbPath = getDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    console.log('[Database] Connection closed');
  }
}
