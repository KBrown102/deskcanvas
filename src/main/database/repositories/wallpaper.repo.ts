import { getDatabase, saveDatabase } from '../db';
import type { Wallpaper, ListFilter } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class WallpaperRepository {
  /**
   * 创建壁纸记录
   */
  async create(data: Omit<Wallpaper, 'id' | 'createdAt'>): Promise<Wallpaper> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO wallpapers (id, name, type, filePath, thumbnailPath, resolution, duration, tags, isFavorite, isAIGenerated, createdAt, lastUsedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.type,
        data.filePath,
        data.thumbnailPath || null,
        data.resolution || null,
        data.duration || null,
        JSON.stringify(data.tags || []),
        data.isFavorite ? 1 : 0,
        data.isAIGenerated ? 1 : 0,
        now,
        data.lastUsedAt || null,
      ]
    );
    saveDatabase();

    return { ...data, id, createdAt: now };
  }

  /**
   * 根据 ID 查找壁纸
   */
  async findById(id: string): Promise<Wallpaper | null> {
    const db = await getDatabase();
    const results = db.exec('SELECT * FROM wallpapers WHERE id = ?', [id]);
    if (results.length === 0 || results[0].values.length === 0) return null;
    return this.mapRow(results[0].columns, results[0].values[0]);
  }

  /**
   * 根据文件路径查找壁纸（用于重复导入检测）
   */
  async findByFilePath(filePath: string): Promise<Wallpaper | null> {
    const db = await getDatabase();
    const results = db.exec('SELECT * FROM wallpapers WHERE filePath = ?', [filePath]);
    if (results.length === 0 || results[0].values.length === 0) return null;
    return this.mapRow(results[0].columns, results[0].values[0]);
  }

  /**
   * 查询壁纸列表（支持筛选、排序、分页）
   */
  async findAll(filter?: ListFilter): Promise<Wallpaper[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM wallpapers WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter?.isFavorite !== undefined) {
      query += ' AND isFavorite = ?';
      params.push(filter.isFavorite ? 1 : 0);
    }
    if (filter?.isAIGenerated !== undefined) {
      query += ' AND isAIGenerated = ?';
      params.push(filter.isAIGenerated ? 1 : 0);
    }
    if (filter?.tag) {
      query += ' AND tags LIKE ?';
      params.push(`%"${filter.tag}"%`);
    }
    if (filter?.keyword) {
      query += ' AND (name LIKE ? OR tags LIKE ?)';
      const kw = `%${filter.keyword}%`;
      params.push(kw, kw);
    }

    const sortBy = filter?.sortBy || 'createdAt';
    const sortOrder = filter?.sortOrder || 'desc';
    const allowedSorts = ['createdAt', 'lastUsedAt', 'name'];
    const allowedOrders = ['asc', 'desc'];
    const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';
    const safeOrder = allowedOrders.includes(sortOrder) ? sortOrder : 'desc';
    query += ` ORDER BY ${safeSort} ${safeOrder}`;

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }
    if (filter?.offset) {
      query += ' OFFSET ?';
      params.push(filter.offset);
    }

    const results = db.exec(query, params);
    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map((row: unknown[]) => this.mapRow(columns, row));
  }

  /**
   * 更新壁纸信息
   */
  async update(id: string, data: Partial<Wallpaper>): Promise<Wallpaper | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const db = await getDatabase();
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(data.tags)); }
    if (data.isFavorite !== undefined) { fields.push('isFavorite = ?'); params.push(data.isFavorite ? 1 : 0); }
    if (data.thumbnailPath !== undefined) { fields.push('thumbnailPath = ?'); params.push(data.thumbnailPath); }
    if (data.duration !== undefined) { fields.push('duration = ?'); params.push(data.duration); }

    if (fields.length === 0) return existing;

    params.push(id);
    db.run(`UPDATE wallpapers SET ${fields.join(', ')} WHERE id = ?`, params);
    saveDatabase();

    return this.findById(id);
  }

  /**
   * 切换收藏状态
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const wallpaper = await this.findById(id);
    if (!wallpaper) return false;

    const db = await getDatabase();
    const newVal = wallpaper.isFavorite ? 0 : 1;
    db.run('UPDATE wallpapers SET isFavorite = ? WHERE id = ?', [newVal, id]);
    saveDatabase();
    return newVal === 1;
  }

  /**
   * 更新最后使用时间
   */
  async updateLastUsed(id: string): Promise<void> {
    const db = await getDatabase();
    db.run("UPDATE wallpapers SET lastUsedAt = datetime('now', 'localtime') WHERE id = ?", [id]);
    saveDatabase();
  }

  /**
   * 删除壁纸记录
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    db.run('DELETE FROM wallpapers WHERE id = ?', [id]);
    saveDatabase();
    return true;
  }

  /**
   * 统计壁纸数量
   */
  async count(filter?: ListFilter): Promise<number> {
    const db = await getDatabase();
    let query = 'SELECT COUNT(*) as count FROM wallpapers WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter?.isFavorite !== undefined) {
      query += ' AND isFavorite = ?';
      params.push(filter.isFavorite ? 1 : 0);
    }

    const results = db.exec(query, params);
    if (results.length === 0) return 0;
    return (results[0].values[0][0] as number) || 0;
  }

  /**
   * 将数据库行映射为 Wallpaper 对象
   */
  private mapRow(columns: string[], row: unknown[]): Wallpaper {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });

    return {
      id: obj.id as string,
      name: obj.name as string,
      type: obj.type as 'image' | 'html' | 'video',
      filePath: obj.filePath as string,
      thumbnailPath: (obj.thumbnailPath as string) || null,
      resolution: (obj.resolution as string) || null,
      duration: (obj.duration as number) || null,
      tags: JSON.parse((obj.tags as string) || '[]'),
      isFavorite: (obj.isFavorite as number) === 1,
      isAIGenerated: (obj.isAIGenerated as number) === 1,
      createdAt: obj.createdAt as string,
      lastUsedAt: (obj.lastUsedAt as string) || null,
    };
  }
}
