import React, { useEffect, useState } from 'react';
import { Button, Tag, message, Empty } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PictureOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import type { AIGeneration } from '../../shared/types';

declare global {
  interface Window {
    api: {
      ai: {
        getHistory: (limit?: number) => Promise<AIGeneration[]>;
      };
      wallpaper: {
        setImage: (id: string, style?: string) => Promise<{ success: boolean; error?: string }>;
        setHTML: (id: string) => Promise<{ success: boolean; error?: string }>;
      };
      system: {
        getFileAsDataURL: (filePath: string) => Promise<string | null>;
      };
    };
  }
}

const C = {
  card: 'rgba(255,255,255,0.06)',
  text: '#F0F0F5',
  text2: 'rgba(240,240,245,0.6)',
  text3: 'rgba(240,240,245,0.35)',
  brand: '#6C5CE7',
  brandLight: '#A29BFE',
  success: '#00B894',
  error: '#E17055',
  border: 'rgba(255,255,255,0.08)',
  warning: '#FDCB6E',
};

const statusConfig = {
  success: { color: C.success, icon: <CheckCircleOutlined />, label: '成功' },
  failed: { color: C.error, icon: <CloseCircleOutlined />, label: '失败' },
  pending: { color: C.warning, icon: <LoadingOutlined spin />, label: '生成中' },
};

const History: React.FC = () => {
  const [history, setHistory] = useState<AIGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  const loadHistory = async () => {
    setLoading(true);
    try {
      const list = await window.api.ai.getHistory(50);
      setHistory(list);
      // 为图片类型的成功记录加载缩略图
      const urls: Record<string, string> = {};
      for (const item of list) {
        if (item.status === 'success' && item.type === 'image' && item.resultPath) {
          try {
            const url = await window.api.system.getFileAsDataURL(item.resultPath);
            if (url) urls[item.id] = url;
          } catch { /* ignore */ }
        }
      }
      setThumbUrls(urls);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSetAsWallpaper = async (item: AIGeneration) => {
    if (!item.wallpaperId) return;
    try {
      const res = item.type === 'image'
        ? await window.api.wallpaper.setImage(item.wallpaperId, 'fill')
        : await window.api.wallpaper.setHTML(item.wallpaperId);
      if (res.success) message.success('已设为壁纸');
      else message.error(res.error || '设置失败');
    } catch (err) {
      message.error(`设置失败: ${String(err)}`);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800 }}>
      <h2 style={{ color: C.text, fontSize: 22, fontWeight: 600, margin: '0 0 24px',
        background: 'linear-gradient(135deg, #F0F0F5, #FDCB6E)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        生成历史
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.text2 }}>加载中...</div>
      ) : history.length === 0 ? (
        <Empty
          description="暂无生成记录"
          style={{ color: C.text2, paddingTop: 60 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((item) => {
            const st = statusConfig[item.status];
            return (
              <div key={item.id} style={{
                background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
                padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start',
              }}>
                {/* 缩略图 / 图标 */}
                <div style={{ width: 80, height: 45, borderRadius: 8, overflow: 'hidden',
                  background: 'rgba(0,0,0,0.3)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.status === 'success' && item.type === 'image' && thumbUrls[item.id] ? (
                    <img src={thumbUrls[item.id]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    item.type === 'image'
                      ? <PictureOutlined style={{ color: C.text3, fontSize: 20 }} />
                      : <CodeOutlined style={{ color: C.text3, fontSize: 20 }} />
                  )}
                </div>

                {/* 信息 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag color={st.color} icon={st.icon} style={{ margin: 0, fontSize: 12 }}>
                      {st.label}
                    </Tag>
                    <Tag style={{ margin: 0, fontSize: 11, background: 'rgba(255,255,255,0.06)',
                      color: C.text2, border: 'none' }}>
                      {item.type === 'image' ? '图片' : 'HTML'}
                    </Tag>
                    <span style={{ fontSize: 11, color: C.text3 }}>{item.providerId}</span>
                    <span style={{ fontSize: 11, color: C.text3, marginLeft: 'auto' }}>
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={item.prompt}>
                    {item.prompt}
                  </div>
                  {item.status === 'failed' && item.errorMessage && (
                    <div style={{ fontSize: 12, color: C.error, marginTop: 4 }}>
                      {item.errorMessage.slice(0, 100)}
                    </div>
                  )}
                </div>

                {/* 操作 */}
                {item.status === 'success' && item.wallpaperId && (
                  <Button
                    size="small"
                    onClick={() => handleSetAsWallpaper(item)}
                    style={{ background: 'rgba(108,92,231,0.2)', color: C.brandLight,
                      border: '1px solid rgba(108,92,231,0.3)', flexShrink: 0 }}
                  >
                    设为壁纸
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default History;
