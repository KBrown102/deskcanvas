import { getDatabase, saveDatabase } from '../db';
import type { AIGeneration } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class GenerationRepository {
  /**
   * 创建生成记录
   */
  async create(data: Omit<AIGeneration, 'id' | 'createdAt'>): Promise<AIGeneration> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO ai_generations (id, type, prompt, providerId, model, resultPath, wallpaperId, status, errorMessage, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.type,
        data.prompt,
        data.providerId,
        data.model || null,
        data.resultPath || null,
        data.wallpaperId || null,
        data.status,
        data.errorMessage || null,
        now,
      ]
    );
    saveDatabase();

    return { ...data, id, createdAt: now };
  }

  /**
   * 根据 ID 查找生成记录
   */
  async findById(id: string): Promise<AIGeneration | null> {
    const db = await getDatabase();
    const results = db.exec('SELECT * FROM ai_generations WHERE id = ?', [id]);
    if (results.length === 0 || results[0].values.length === 0) return null;
    return this.mapRow(results[0].columns, results[0].values[0]);
  }

  /**
   * 查询生成历史（按时间倒序）
   */
  async findAll(limit: number = 50): Promise<AIGeneration[]> {
    const db = await getDatabase();
    const results = db.exec('SELECT * FROM ai_generations ORDER BY createdAt DESC LIMIT ?', [limit]);
    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map((row: unknown[]) => this.mapRow(columns, row));
  }

  /**
   * 更新生成状态
   */
  async updateStatus(id: string, status: AIGeneration['status'], errorMessage?: string): Promise<void> {
    const db = await getDatabase();
    db.run('UPDATE ai_generations SET status = ?, errorMessage = ? WHERE id = ?', [
      status,
      errorMessage || null,
      id,
    ]);
    saveDatabase();
  }

  /**
   * 关联壁纸 ID
   */
  async linkToWallpaper(generationId: string, wallpaperId: string): Promise<void> {
    const db = await getDatabase();
    db.run('UPDATE ai_generations SET wallpaperId = ? WHERE id = ?', [wallpaperId, generationId]);
    saveDatabase();
  }

  /**
   * 删除生成记录
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    db.run('DELETE FROM ai_generations WHERE id = ?', [id]);
    saveDatabase();
    return true;
  }

  private mapRow(columns: string[], row: unknown[]): AIGeneration {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });

    return {
      id: obj.id as string,
      type: obj.type as 'image' | 'html',
      prompt: obj.prompt as string,
      providerId: obj.providerId as string,
      model: (obj.model as string) || null,
      resultPath: (obj.resultPath as string) || null,
      wallpaperId: (obj.wallpaperId as string) || null,
      status: obj.status as AIGeneration['status'],
      errorMessage: (obj.errorMessage as string) || null,
      createdAt: obj.createdAt as string,
    };
  }
}
