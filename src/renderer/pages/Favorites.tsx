import React, { useEffect, useState } from 'react';
import type { Wallpaper } from '../../shared/types';

declare global {
  interface Window {
    api: {
      wallpaper: {
        setImage: (id: string, style?: string) => Promise<{ success: boolean; error?: string }>;
        setHTML: (id: string) => Promise<{ success: boolean; error?: string }>;
        getCurrentId: () => Promise<string | null>;
        cancel: () => Promise<{ success: boolean; error?: string }>;
      };
      library: {
        list: (filter?: any) => Promise<Wallpaper[]>;
        remove: (id: string) => Promise<void>;
        toggleFavorite: (id: string) => Promise<{ isFavorite: boolean }>;
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
  borderLight: 'rgba(255,255,255,0.06)',
};

const Favorites: React.FC = () => {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [activeWallpaperId, setActiveWallpaperId] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const list = await window.api.library.list({ isFavorite: true });
      setWallpapers(list);
      const urls: Record<string, string> = {};
      for (const wp of list) {
        if (wp.thumbnailPath) {
          try {
            const url = await window.api.system.getFileAsDataURL(wp.thumbnailPath);
            if (url) urls[wp.id] = url;
          } catch { /* ignore */ }
        }
      }
      setThumbUrls(urls);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  const detectActive = async () => {
    try {
      const id = await window.api.wallpaper.getCurrentId();
      setActiveWallpaperId(id);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadFavorites();
    detectActive();
  }, []);

  const handleApply = async (wp: Wallpaper) => {
    if (activeWallpaperId === wp.id) {
      setApplyingId(wp.id);
      try {
        await window.api.wallpaper.cancel();
        setActiveWallpaperId(null);
      } catch (err) {
        alert(`取消壁纸失败: ${String(err)}`);
      } finally {
        setApplyingId(null);
      }
      return;
    }
    setApplyingId(wp.id);
    try {
      const result = wp.type === 'image'
        ? await window.api.wallpaper.setImage(wp.id, 'fill')
        : await window.api.wallpaper.setHTML(wp.id);
      if (result.success) setActiveWallpaperId(wp.id);
      else alert(`设置壁纸失败: ${result.error}`);
    } catch (err) {
      alert(`设置壁纸失败: ${String(err)}`);
    } finally {
      setApplyingId(null);
    }
  };

  const handleUnfavorite = async (id: string) => {
    await window.api.library.toggleFavorite(id);
    await loadFavorites();
  };

  const handleDelete = async (id: string) => {
    if (activeWallpaperId === id) {
      await window.api.wallpaper.cancel();
      setActiveWallpaperId(null);
    }
    if (!confirm('确定要删除这个壁纸吗？')) return;
    await window.api.library.remove(id);
    await loadFavorites();
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 8,
          background: 'linear-gradient(135deg, #F0F0F5, #E17055)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          收藏
        </h1>
        <p style={{ color: C.text2, fontSize: 14, margin: 0 }}>你收藏的壁纸</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.text2 }}>加载中...</div>
      ) : wallpapers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: C.text2 }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.35 }}>♡</div>
          <h3 style={{ color: C.text, fontSize: 18, marginBottom: 8 }}>暂无收藏</h3>
          <p style={{ margin: 0 }}>在画廊中点击 ♡ 即可收藏壁纸</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {wallpapers.map((wp) => {
            const isActive = activeWallpaperId === wp.id;
            const isApplying = applyingId === wp.id;
            return (
              <div key={wp.id} style={{
                background: C.card, borderRadius: 16,
                border: isActive ? `2px solid ${C.brand}` : `1px solid ${C.border}`,
                overflow: 'hidden', transition: 'all 0.2s',
              }}>
                <div style={{ width: '100%', aspectRatio: '16/9', background: 'rgba(0,0,0,0.3)',
                  overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                  onDoubleClick={() => handleApply(wp)}>
                  {isActive && (
                    <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px',
                      background: C.brand, borderRadius: 20, fontSize: 11, color: '#fff',
                      fontWeight: 600, zIndex: 2 }}>使用中</div>
                  )}
                  {thumbUrls[wp.id] ? (
                    <img src={thumbUrls[wp.id]} alt={wp.name} style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                    }} />
                  ) : wp.type === 'html' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}>
                      <span style={{ padding: '6px 14px', background: 'rgba(108,92,231,0.3)',
                        border: '1px solid rgba(108,92,231,0.5)', borderRadius: 6,
                        color: C.brandLight, fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>HTML</span>
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: C.text3 }}>
                      无预览
                    </div>
                  )}
                </div>

                <div style={{ padding: '10px 12px 6px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={wp.name}>{wp.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: wp.type === 'image' ? 'rgba(0,184,148,0.15)' : 'rgba(108,92,231,0.15)',
                      color: wp.type === 'image' ? C.success : C.brandLight }}>
                      {wp.type === 'image' ? '图片' : 'HTML'}
                    </span>
                    {wp.resolution && <span style={{ fontSize: 11, color: C.text3 }}>{wp.resolution}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px 10px', borderTop: `1px solid rgba(255,255,255,0.04)` }}>
                  <button onClick={() => handleUnfavorite(wp.id)} title="取消收藏" style={{
                    padding: '6px 8px', border: 'none', borderRadius: 6, background: 'transparent',
                    color: C.error, cursor: 'pointer', fontSize: 14,
                  }}>❤</button>
                  <button onClick={() => handleApply(wp)} disabled={isApplying} style={{
                    flex: 1, padding: '6px 12px', border: 'none', borderRadius: 6,
                    background: isActive
                      ? 'rgba(225,112,85,0.2)'
                      : isApplying ? 'rgba(108,92,231,0.1)' : 'rgba(108,92,231,0.2)',
                    color: isActive ? C.error : C.brandLight,
                    cursor: isApplying ? 'not-allowed' : 'pointer',
                    opacity: isApplying ? 0.5 : 1, fontWeight: 500, fontSize: 12,
                  }}>{isApplying ? '操作中...' : isActive ? '取消壁纸' : '设为壁纸'}</button>
                  <button onClick={() => handleDelete(wp.id)} title="删除" style={{
                    padding: '6px 8px', border: 'none', borderRadius: 6, background: 'transparent',
                    color: C.text3, cursor: 'pointer', fontSize: 14,
                  }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Favorites;
