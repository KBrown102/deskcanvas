import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Wallpaper } from '../../shared/types';

declare global {
  interface Window {
    api: {
      wallpaper: {
        setImage: (id: string, style?: string) => Promise<{ success: boolean; error?: string }>;
        setHTML: (id: string) => Promise<{ success: boolean; error?: string }>;
        setVideo: (id: string) => Promise<{ success: boolean; error?: string }>;
        reset: () => Promise<void>;
        getCurrent: () => Promise<Wallpaper | null>;
        getCurrentId: () => Promise<string | null>;
        getFileUrl: (id: string) => Promise<string | null>;
        cancel: () => Promise<{ success: boolean; error?: string }>;
      };
      library: {
        list: (filter?: any) => Promise<Wallpaper[]>;
        add: (filePath: string) => Promise<any>;
        remove: (id: string) => Promise<{ success: boolean; error?: string }>;
        update: (id: string, data: Partial<Wallpaper>) => Promise<Wallpaper>;
        toggleFavorite: (id: string) => Promise<{ isFavorite: boolean }>;
        importHTML: (path: string) => Promise<any>;
        importVideo: (path: string) => Promise<any>;
      };
      system: {
        getScreenInfo: () => Promise<{ width: number; height: number; scale: number }>;
        selectFile: (options?: any) => Promise<string | null>;
        selectDirectory: () => Promise<string | null>;
        getFileAsDataURL: (filePath: string) => Promise<string | null>;
        showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}

// 颜色常量
const C = {
  bg: '#0F0F1A',
  card: 'rgba(255,255,255,0.06)',
  cardHover: 'rgba(255,255,255,0.10)',
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

/** 预制标签 */
const PRESET_TAGS = ['风景', '动漫', '抽象', '科技', '自然', '城市', '简约', '暗色', '明亮', 'AI生成'];

const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'html' | 'video'>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [activeWallpaperId, setActiveWallpaperId] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  // 标签编辑
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState('');
  const customTagRef = useRef<HTMLInputElement>(null);

  /** 收集所有已使用的标签（预制 + 自定义） */
  const allTags = React.useMemo(() => {
    const used = new Set<string>(PRESET_TAGS);
    wallpapers.forEach(wp => wp.tags?.forEach(t => used.add(t)));
    return Array.from(used);
  }, [wallpapers]);

  /** 加载壁纸列表和缩略图 */
  const loadWallpapers = async () => {
    setLoading(true);
    try {
      const filterParam: any = {};
      if (filter !== 'all') filterParam.type = filter;
      if (activeTag) filterParam.tag = activeTag;
      const list = await window.api.library.list(filterParam);
      setWallpapers(list);
      // 加载缩略图
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
      console.error('Failed to load wallpapers:', err);
    } finally {
      setLoading(false);
    }
  };

  /** 检测当前正在使用的壁纸 */
  const detectActiveWallpaper = async () => {
    try {
      const id = await window.api.wallpaper.getCurrentId();
      setActiveWallpaperId(id);
    } catch {
      setActiveWallpaperId(null);
    }
  };

  useEffect(() => {
    loadWallpapers();
    detectActiveWallpaper();
  }, [filter, activeTag]);

  const handleImportImage = async () => {
    const filePath = await window.api.system.selectFile({
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
    });
    if (!filePath) return;
    const result = await window.api.library.add(filePath);
    if (result.success) { await loadWallpapers(); await detectActiveWallpaper(); }
    else alert(`导入失败: ${result.error}`);
  };

  const handleImportHTML = async () => {
    const dirPath = await window.api.system.selectDirectory();
    if (!dirPath) return;
    const result = await window.api.library.importHTML(dirPath);
    if (result.success) { await loadWallpapers(); await detectActiveWallpaper(); }
    else alert(`导入失败: ${result.error}`);
  };

  const handleImportHTMLFile = async () => {
    const filePath = await window.api.system.selectFile({
      filters: [{ name: 'HTML 文件', extensions: ['html', 'htm'] }],
    });
    if (!filePath) return;
    const result = await window.api.library.add(filePath);
    if (result.success) { await loadWallpapers(); await detectActiveWallpaper(); }
    else alert(`导入失败: ${result.error}`);
  };

  const handleImportVideo = async () => {
    const filePath = await window.api.system.selectFile({
      filters: [{ name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }],
    });
    if (!filePath) return;
    const result = await window.api.library.importVideo(filePath);
    if (result.success) { await loadWallpapers(); await detectActiveWallpaper(); }
    else alert(`导入失败: ${result.error}`);
  };

  /** 设为壁纸 / 取消壁纸 */
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
        : wp.type === 'video'
          ? await window.api.wallpaper.setVideo(wp.id)
          : await window.api.wallpaper.setHTML(wp.id);
      if (result.success) {
        setActiveWallpaperId(wp.id);
      } else {
        alert(`设置壁纸失败: ${result.error}`);
      }
    } catch (err) {
      alert(`设置壁纸失败: ${String(err)}`);
    } finally {
      setApplyingId(null);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const result = await window.api.library.toggleFavorite(id);
    setWallpapers(prev => prev.map(wp =>
      wp.id === id ? { ...wp, isFavorite: result.isFavorite } : wp
    ));
  };

  const handleDelete = async (id: string) => {
    if (activeWallpaperId === id) {
      await window.api.wallpaper.cancel();
      setActiveWallpaperId(null);
    }
    if (!confirm('确定要删除这个壁纸吗？')) return;
    const result = await window.api.library.remove(id);
    if (result && !result.success) {
      alert(`删除失败: ${result.error}`);
      return;
    }
    await loadWallpapers();
  };

  const handleShowInFolder = async (wp: Wallpaper) => {
    await window.api.system.showInFolder(wp.filePath);
  };

  // ─── 标签管理 ──

  /** 切换标签筛选 */
  const handleTagFilter = (tag: string) => {
    setActiveTag(prev => prev === tag ? null : tag);
  };

  /** 开始编辑某张壁纸的标签 */
  const handleStartEditTags = (id: string) => {
    setEditingTagId(id);
    setCustomTagInput('');
    setTimeout(() => customTagRef.current?.focus(), 50);
  };

  /** 切换某张壁纸的某个标签 */
  const handleToggleTag = async (wp: Wallpaper, tag: string) => {
    const hasTag = wp.tags?.includes(tag);
    const newTags = hasTag
      ? wp.tags.filter(t => t !== tag)
      : [...(wp.tags || []), tag];
    const updated = await window.api.library.update(wp.id, { tags: newTags });
    if (updated) {
      setWallpapers(prev => prev.map(w => w.id === wp.id ? { ...w, tags: newTags } : w));
    }
  };

  /** 添加自定义标签 */
  const handleAddCustomTag = async (wp: Wallpaper) => {
    const tag = customTagInput.trim();
    if (!tag) return;
    if (wp.tags?.includes(tag)) { setCustomTagInput(''); return; }
    const newTags = [...(wp.tags || []), tag];
    const updated = await window.api.library.update(wp.id, { tags: newTags });
    if (updated) {
      setWallpapers(prev => prev.map(w => w.id === wp.id ? { ...w, tags: newTags } : w));
      setCustomTagInput('');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* 悬浮效果 CSS */}
      <style>{`
        .gallery-card { transition: box-shadow 0.25s ease; }
        .gallery-card:hover { box-shadow: 0 8px 24px rgba(108,92,231,0.15); }
        .gallery-thumb-img { transition: transform 0.35s ease; }
        .gallery-card:hover .gallery-thumb-img { transform: scale(1.08); }
      `}</style>

      {/* 页面标题 */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 8,
          background: 'linear-gradient(135deg, #F0F0F5, #A29BFE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          壁纸画廊
        </h1>
        <p style={{ color: C.text2, fontSize: 14, margin: 0 }}>浏览和管理你的壁纸收藏</p>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, padding: '12px 16px', background: C.card, borderRadius: 12,
        border: `1px solid ${C.borderLight}` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'image', 'html', 'video'] as const).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)} style={{
              padding: '6px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, transition: 'all 0.2s',
              background: filter === tab ? 'rgba(108,92,231,0.2)' : 'transparent',
              color: filter === tab ? C.brandLight : C.text2,
            }}>
              {tab === 'all' ? '全部' : tab === 'image' ? '图片' : tab === 'html' ? 'HTML' : '视频'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleImportImage} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            border: `1px solid rgba(108,92,231,0.4)`, borderRadius: 12, cursor: 'pointer',
            background: 'rgba(108,92,231,0.1)', color: C.brandLight, fontSize: 13,
          }}>导入图片</button>
          <button onClick={handleImportHTMLFile} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            border: `1px solid rgba(108,92,231,0.4)`, borderRadius: 12, cursor: 'pointer',
            background: 'rgba(108,92,231,0.1)', color: C.brandLight, fontSize: 13,
          }}>导入 HTML 文件</button>
          <button onClick={handleImportHTML} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            border: `1px solid rgba(108,92,231,0.4)`, borderRadius: 12, cursor: 'pointer',
            background: 'rgba(108,92,231,0.1)', color: C.brandLight, fontSize: 13,
          }}>导入 HTML 文件夹</button>
          <button onClick={handleImportVideo} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            border: `1px solid rgba(108,92,231,0.4)`, borderRadius: 12, cursor: 'pointer',
            background: 'rgba(108,92,231,0.1)', color: C.brandLight, fontSize: 13,
          }}>导入视频</button>
        </div>
      </div>

      {/* 标签筛选栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        padding: '8px 16px', background: C.card, borderRadius: 12,
        border: `1px solid ${C.borderLight}`, flexWrap: 'wrap' }}>
        <span style={{ color: C.text3, fontSize: 12, marginRight: 4 }}>标签：</span>
        {allTags.map((tag) => {
          const isActive = activeTag === tag;
          return (
            <button key={tag} onClick={() => handleTagFilter(tag)} style={{
              padding: '3px 12px', border: 'none', borderRadius: 20, cursor: 'pointer',
              fontSize: 12, transition: 'all 0.2s',
              background: isActive ? 'rgba(108,92,231,0.3)' : 'rgba(255,255,255,0.04)',
              color: isActive ? C.brandLight : C.text2,
              outline: isActive ? `1px solid ${C.brand}` : 'none',
            }}>{tag}</button>
          );
        })}
        {activeTag && (
          <button onClick={() => setActiveTag(null)} style={{
            padding: '3px 10px', border: 'none', borderRadius: 20, cursor: 'pointer',
            fontSize: 11, background: 'rgba(225,112,85,0.2)', color: C.error,
          }}>清除筛选</button>
        )}
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.text2 }}>加载中...</div>
      ) : wallpapers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: C.text2 }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.35 }}></div>
          <h3 style={{ color: C.text, fontSize: 18, marginBottom: 8 }}>
            {activeTag ? `没有「${activeTag}」标签的壁纸` : '还没有壁纸'}
          </h3>
          <p style={{ margin: 0 }}>
            {activeTag ? '试试其他标签，或清除筛选' : '点击上方按钮导入图片或 HTML 壁纸'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {wallpapers.map((wp) => {
            const isActive = activeWallpaperId === wp.id;
            const isApplying = applyingId === wp.id;
            const isEditingTags = editingTagId === wp.id;
            return (
              <div key={wp.id} className="gallery-card" style={{
                background: C.card, borderRadius: 16,
                border: isActive ? `2px solid ${C.brand}` : `1px solid ${C.border}`,
                overflow: 'hidden', cursor: 'pointer',
              }}
                onClick={() => navigate(`/detail/${wp.id}`)}>
                {/* 缩略图 */}
                <div style={{ width: '100%', aspectRatio: '16/9', background: 'rgba(0,0,0,0.3)',
                  overflow: 'hidden', position: 'relative' }}
                  onDoubleClick={(e) => { e.stopPropagation(); handleApply(wp); }}>
                  {isActive && (
                    <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px',
                      background: C.brand, borderRadius: 20, fontSize: 11, color: '#fff',
                      fontWeight: 600, zIndex: 2 }}>使用中</div>
                  )}
                  {thumbUrls[wp.id] ? (
                    <img className="gallery-thumb-img" src={thumbUrls[wp.id]} alt={wp.name} style={{
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
                  ) : wp.type === 'video' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, #1e1e3f, #2d1b4e)' }}>
                      <span style={{ padding: '6px 14px', background: 'rgba(253,121,168,0.3)',
                        border: '1px solid rgba(253,121,168,0.5)', borderRadius: 6,
                        color: '#fd79a8', fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>VIDEO</span>
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: C.text3 }}>
                      无预览
                    </div>
                  )}
                </div>

                {/* 信息 */}
                <div style={{ padding: '10px 12px 6px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={wp.name}>{wp.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: wp.type === 'image' ? 'rgba(0,184,148,0.15)' : wp.type === 'video' ? 'rgba(253,121,168,0.15)' : 'rgba(108,92,231,0.15)',
                      color: wp.type === 'image' ? C.success : wp.type === 'video' ? '#fd79a8' : C.brandLight }}>
                      {wp.type === 'image' ? '图片' : wp.type === 'video' ? '视频' : 'HTML'}
                    </span>
                    {wp.resolution && <span style={{ fontSize: 11, color: C.text3 }}>{wp.resolution}</span>}
                  </div>
                </div>

                {/* 标签区域 */}
                <div style={{ padding: '4px 12px 6px', minHeight: 28, display: 'flex', flexWrap: 'wrap', gap: 4 }}
                  onClick={e => e.stopPropagation()}>
                  {isEditingTags ? (
                    <>
                      {/* 预制标签选择 */}
                      {PRESET_TAGS.map(tag => {
                        const hasTag = wp.tags?.includes(tag);
                        return (
                          <button key={tag} onClick={() => handleToggleTag(wp, tag)} style={{
                            padding: '2px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
                            fontSize: 10, transition: 'all 0.15s',
                            background: hasTag ? 'rgba(108,92,231,0.3)' : 'rgba(255,255,255,0.04)',
                            color: hasTag ? C.brandLight : C.text3,
                            outline: hasTag ? `1px solid ${C.brand}` : '1px solid transparent',
                          }}>{tag}</button>
                        );
                      })}
                      {/* 自定义标签输入 */}
                      <div style={{ display: 'flex', gap: 4, width: '100%', marginTop: 4 }}>
                        <input
                          ref={customTagRef}
                          value={customTagInput}
                          onChange={e => setCustomTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddCustomTag(wp); }}
                          placeholder="输入自定义标签..."
                          style={{
                            flex: 1, padding: '3px 8px', border: `1px solid ${C.border}`,
                            borderRadius: 6, background: 'rgba(255,255,255,0.04)',
                            color: C.text, fontSize: 11, outline: 'none',
                          }}
                        />
                        <button onClick={() => handleAddCustomTag(wp)} style={{
                          padding: '3px 8px', border: 'none', borderRadius: 6,
                          background: 'rgba(108,92,231,0.3)', color: C.brandLight,
                          cursor: 'pointer', fontSize: 11,
                        }}>添加</button>
                      </div>
                      {/* 已选的非预制标签 */}
                      {wp.tags?.filter(t => !PRESET_TAGS.includes(t)).map(tag => (
                        <button key={tag} onClick={() => handleToggleTag(wp, tag)} style={{
                          padding: '2px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
                          fontSize: 10, background: 'rgba(108,92,231,0.3)',
                          color: C.brandLight, outline: `1px solid ${C.brand}`,
                        }}>{tag} </button>
                      ))}
                      <button onClick={() => setEditingTagId(null)} style={{
                        padding: '2px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
                        fontSize: 10, background: 'rgba(255,255,255,0.06)', color: C.text2,
                        marginTop: 4,
                      }}>完成</button>
                    </>
                  ) : (
                    <>
                      {wp.tags?.slice(0, 4).map(tag => (
                        <span key={tag} onClick={() => handleTagFilter(tag)} style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 10,
                          background: 'rgba(108,92,231,0.12)', color: C.brandLight,
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}
                          onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(108,92,231,0.25)'}
                          onMouseLeave={e => (e.target as HTMLElement).style.background = 'rgba(108,92,231,0.12)'}
                        >{tag}</span>
                      ))}
                      {wp.tags && wp.tags.length > 4 && (
                        <span style={{ fontSize: 10, color: C.text3 }}>+{wp.tags.length - 4}</span>
                      )}
                      <button onClick={() => handleStartEditTags(wp.id)} title="编辑标签" style={{
                        padding: '2px 6px', border: 'none', borderRadius: 6, background: 'transparent',
                        color: C.text3, cursor: 'pointer', fontSize: 11, marginLeft: 'auto',
                      }}>✎</button>
                    </>
                  )}
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px 10px', borderTop: `1px solid rgba(255,255,255,0.04)` }}
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleToggleFavorite(wp.id)} title={wp.isFavorite ? '取消收藏' : '收藏'} style={{
                    padding: '6px 8px', border: 'none', borderRadius: 6, background: 'transparent',
                    color: wp.isFavorite ? C.error : C.text2, cursor: 'pointer', fontSize: 14,
                  }}>{wp.isFavorite ? '❤' : '♡'}</button>
                  <button onClick={() => handleShowInFolder(wp)} title="打开文件所在目录" style={{
                    padding: '6px 8px', border: 'none', borderRadius: 6, background: 'transparent',
                    color: C.text2, cursor: 'pointer', fontSize: 13,
                  }}>📁</button>
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

export default Gallery;
