import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Wallpaper } from '../../shared/types';

// 颜色常量（与 Gallery 一致）
const C = {
  bg: '#0F0F1A',
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
  pink: '#fd79a8',
};

/** 预览窗口上限（秒） */
const MAX_PREVIEW = 10;

/** mm:ss 格式化 */
const fmt = (s: number) => {
  const sec = Math.max(0, Math.floor(s));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const Detail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [wallpaper, setWallpaper] = useState<Wallpaper | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null); // HTML iframe 实时预览
  const [applying, setApplying] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // ---- video player state ----
  const [playing, setPlaying] = useState(false);
  const [, setTick] = useState(0);           // force re-render for countdown
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(true);  // 默认静音（壁纸预览场景）
  const [fullscreen, setFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 视频真实时长 & 预览窗口时长
  const [videoDuration, setVideoDuration] = useState(0);
  const previewDur = Math.min(videoDuration || MAX_PREVIEW, MAX_PREVIEW);
  const previewDurRef = useRef(MAX_PREVIEW);
  previewDurRef.current = previewDur; // 同步更新 ref，供 listener 闭包读取

  // ---- 加载壁纸数据 ----
  const loadWallpaper = useCallback(async () => {
    if (!id) return;
    try {
      const list = await window.api.library.list({});
      const wp = list.find(w => w.id === id);
      if (!wp) { navigate('/gallery'); return; }
      setWallpaper(wp);

      const currentId = await window.api.wallpaper.getCurrentId();
      setIsActive(currentId === id);

      if (wp.type === 'image') {
        setPreviewUrl(await window.api.system.getFileAsDataURL(wp.filePath));
      } else if (wp.type === 'video') {
        setPreviewUrl(await window.api.wallpaper.getFileUrl(wp.id));
      } else if (wp.type === 'html') {
        // 构造 file:// URL 用于 iframe 实时渲染
        const fp = wp.filePath.replace(/\\/g, '/');
        const entryPath = /\.html?$/i.test(fp) ? fp : `${fp}/index.html`;
        setHtmlUrl(`file:///${entryPath}`);
        // 同时加载缩略图截图作为信息区的辅助展示
        if (wp.thumbnailPath) {
          setPreviewUrl(await window.api.system.getFileAsDataURL(wp.thumbnailPath));
        }
      }
    } catch (err) {
      console.error('Failed to load wallpaper detail:', err);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadWallpaper();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadWallpaper]);

  // 100ms 刷新倒计时显示
  useEffect(() => {
    if (wallpaper?.type !== 'video' || !playing) return;
    timerRef.current = setInterval(() => setTick(t => t + 1), 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [wallpaper?.type, playing]);

  // ---- video event handlers ----
  const handleLoadedMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    const dur = isFinite(v.duration) ? v.duration : MAX_PREVIEW;
    setVideoDuration(dur);
    previewDurRef.current = Math.min(dur, MAX_PREVIEW);
    v.volume = volume;
    v.muted = muted;
    v.play().then(() => setPlaying(true)).catch(() => {});
  };

  // 长视频 (>10s) 到预览窗口末尾自动 seek 回首
  // 短视频 (<10s) 靠 loop 属性自然循环
  useEffect(() => {
    const v = videoRef.current;
    if (!v || wallpaper?.type !== 'video') return;
    const onTime = () => {
      const pd = previewDurRef.current;
      if (pd > 0 && pd < videoDuration && v.currentTime >= pd + 0.15) {
        v.currentTime = 0;
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [wallpaper?.type, videoDuration]);

  // ---- playback controls ----
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); }
    else { v.pause(); setPlaying(false); }
  };

  const seekFromEvent = (e: React.MouseEvent) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * previewDur;
  };

  const onVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    if (val > 0 && muted) { setMuted(false); if (videoRef.current) videoRef.current.muted = false; }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ---- keyboard shortcuts ----
  const onKey = (e: React.KeyboardEvent) => {
    if (wallpaper?.type !== 'video') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowLeft') {
      const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 2);
    } else if (e.code === 'ArrowRight') {
      const v = videoRef.current; if (v) v.currentTime = Math.min(previewDur, v.currentTime + 2);
    }
  };

  // ---- wallpaper actions ----
  const handleApply = async () => {
    if (!wallpaper) return;
    setApplying(true);
    try {
      if (isActive) {
        await window.api.wallpaper.cancel();
        setIsActive(false);
      } else {
        const result = wallpaper.type === 'image'
          ? await window.api.wallpaper.setImage(wallpaper.id, 'fill')
          : wallpaper.type === 'video'
            ? await window.api.wallpaper.setVideo(wallpaper.id)
            : await window.api.wallpaper.setHTML(wallpaper.id);
        if (result.success) setIsActive(true);
        else alert(`设置壁纸失败: ${result.error}`);
      }
    } catch (err) { alert(`操作失败: ${String(err)}`); }
    finally { setApplying(false); }
  };

  const handleToggleFavorite = async () => {
    if (!wallpaper) return;
    const result = await window.api.library.toggleFavorite(wallpaper.id);
    setWallpaper(prev => prev ? { ...prev, isFavorite: result.isFavorite } : null);
  };

  const handleShowInFolder = async () => {
    if (wallpaper) await window.api.system.showInFolder(wallpaper.filePath);
  };

  const handleDelete = async () => {
    if (!wallpaper) return;
    if (!confirm('确定要删除这个壁纸吗？')) return;
    if (isActive) await window.api.wallpaper.cancel();
    const result = await window.api.library.remove(wallpaper.id);
    if (result && !result.success) { alert(`删除失败: ${result.error}`); return; }
    navigate('/gallery');
  };

  // ---- render helpers ----
  const typeColor = wallpaper?.type === 'image' ? C.success
    : wallpaper?.type === 'video' ? C.pink : C.brandLight;
  const typeLabel = wallpaper?.type === 'image' ? '图片'
    : wallpaper?.type === 'video' ? '视频' : 'HTML';
  const typeBg = wallpaper?.type === 'image' ? 'rgba(0,184,148,0.15)'
    : wallpaper?.type === 'video' ? 'rgba(253,121,168,0.15)' : 'rgba(108,92,231,0.15)';

  const v = videoRef.current;
  const curTime = v ? Math.min(v.currentTime, previewDur) : 0;
  const progress = previewDur > 0 ? (curTime / previewDur) * 100 : 0;
  const countdown = Math.max(0, Math.ceil(previewDur - curTime));

  if (!wallpaper) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.text2 }}>加载中...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* 返回按钮 */}
      <button onClick={() => navigate('/gallery')} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
        background: C.card, color: C.text2, marginBottom: 20,
      }}>
        <span style={{ fontSize: 18 }}>&larr;</span> 返回画廊
      </button>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* ============ 左侧：预览区域 ============ */}
        <div style={{ flex: 1 }}>
          <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={onKey}
            className="dc-preview-box"
            style={{
              width: '100%', aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden',
              background: '#000', position: 'relative', border: `1px solid ${C.border}`,
              outline: 'none',
            }}
          >
            {/* ---- 图片预览 ---- */}
            {wallpaper.type === 'image' && previewUrl && (
              <img src={previewUrl} alt={wallpaper.name} style={{
                width: '100%', height: '100%', objectFit: 'contain',
              }} />
            )}

            {/* ---- 视频预览 ---- */}
            {wallpaper.type === 'video' && previewUrl && (
              <>
                <video
                  ref={videoRef}
                  src={previewUrl}
                  playsInline
                  muted
                  loop={videoDuration > 0 && videoDuration <= MAX_PREVIEW}
                  preload="auto"
                  onLoadedMetadata={handleLoadedMeta}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />

                {/* 预览时长徽章 */}
                <div style={{
                  position: 'absolute', top: 12, right: 12, padding: '4px 12px',
                  background: 'rgba(0,0,0,0.65)', borderRadius: 20, fontSize: 12,
                  color: '#fff', fontWeight: 600, backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: playing ? C.pink : C.text3,
                    animation: playing ? 'dc-pulse 1.2s infinite' : 'none',
                  }} />
                  {videoDuration > MAX_PREVIEW ? `预览 ${MAX_PREVIEW}s` : `预览 ${Math.round(videoDuration || 0)}s`}
                </div>

                {/* 长视频提示 */}
                {videoDuration > MAX_PREVIEW && (
                  <div style={{
                    position: 'absolute', top: 12, left: 12, padding: '4px 10px',
                    background: 'rgba(0,0,0,0.55)', borderRadius: 20, fontSize: 11,
                    color: C.text2, backdropFilter: 'blur(4px)', pointerEvents: 'none',
                  }}>
                    应用后查看完整视频 ({fmt(videoDuration)})
                  </div>
                )}

                {/* 底部渐变 + 控件 */}
                <div className="dc-controls" style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  padding: '28px 16px 12px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  opacity: 1, transition: 'opacity 0.3s',
                }}>
                  {/* 进度条 */}
                  <div
                    ref={progressRef}
                    onClick={seekFromEvent}
                    style={{
                      height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2,
                      cursor: 'pointer', position: 'relative', padding: '8px 0',
                      margin: '-8px 0', backgroundClip: 'content-box',
                    }}
                  >
                    <div style={{
                      height: '100%', width: `${progress}%`,
                      background: C.brand, borderRadius: 2, position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)',
                        width: 12, height: 12, borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                      }} />
                    </div>
                  </div>

                  {/* 控件行 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* 播放/暂停 */}
                    <button onClick={togglePlay} style={{
                      background: 'none', border: 'none', color: '#fff',
                      fontSize: 18, cursor: 'pointer', padding: '2px 4px',
                      display: 'flex', alignItems: 'center',
                    }}>
                      {playing ? '⏸' : '▶'}
                    </button>

                    {/* 时间 */}
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', minWidth: 80, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(curTime)} / {fmt(previewDur)}
                    </span>

                    <div style={{ flex: 1 }} />

                    {/* 倒计时 */}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      预览 {countdown}s
                    </span>

                    {/* 音量 */}
                    <button onClick={toggleMute} style={{
                      background: 'none', border: 'none', color: '#fff',
                      fontSize: 15, cursor: 'pointer', padding: '2px 4px',
                    }}>
                      {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                    </button>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={muted ? 0 : volume}
                      onChange={onVolumeChange}
                      className="dc-vol"
                      style={{ width: 60, accentColor: C.brand, cursor: 'pointer' }}
                    />

                    {/* 全屏 */}
                    <button onClick={toggleFullscreen} style={{
                      background: 'none', border: 'none', color: '#fff',
                      fontSize: 14, cursor: 'pointer', padding: '2px 4px',
                    }}>
                      {fullscreen ? '退出' : '⛶'}
                    </button>
                  </div>
                </div>

                {/* CSS: 悬停显示控件 + 脉冲动画 + 音量滑块 */}
                <style>{`
                  .dc-preview-box .dc-controls { opacity: 0; transition: opacity 0.3s; }
                  .dc-preview-box:hover .dc-controls { opacity: 1; }
                  @keyframes dc-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                  }
                  .dc-vol::-webkit-slider-thumb { width: 10px; height: 10px; }
                `}</style>
              </>
            )}

            {/* ---- HTML 实时预览 (iframe) ---- */}
            {wallpaper.type === 'html' && htmlUrl && (
              <>
                <iframe
                  src={htmlUrl}
                  sandbox="allow-scripts"
                  style={{
                    width: '100%', height: '100%', border: 'none',
                    pointerEvents: 'none', // 禁止用户与 iframe 交互
                  }}
                  title="HTML 壁纸预览"
                />
                <div style={{
                  position: 'absolute', bottom: 12, left: 12, padding: '4px 12px',
                  background: 'rgba(0,0,0,0.6)', borderRadius: 20, fontSize: 12,
                  color: C.brandLight, backdropFilter: 'blur(4px)', pointerEvents: 'none',
                }}>HTML 动态壁纸实时预览</div>
              </>
            )}

            {/* HTML 无 iframe 时的截图 fallback */}
            {wallpaper.type === 'html' && !htmlUrl && previewUrl && (
              <>
                <img src={previewUrl} alt={wallpaper.name} style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
                <div style={{
                  position: 'absolute', bottom: 12, left: 12, padding: '4px 12px',
                  background: 'rgba(0,0,0,0.6)', borderRadius: 20, fontSize: 12,
                  color: C.brandLight, backdropFilter: 'blur(4px)',
                }}>HTML 动态壁纸截图预览</div>
              </>
            )}

            {/* HTML 无任何预览 */}
            {wallpaper.type === 'html' && !htmlUrl && !previewUrl && (
              <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'linear-gradient(135deg, rgba(108,92,231,0.12), rgba(162,155,254,0.06))',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: 'rgba(108,92,231,0.2)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 28,
                }}>&lt;/&gt;</div>
                <span style={{ color: C.brandLight, fontSize: 15, fontWeight: 600 }}>HTML 动态壁纸</span>
                <span style={{ color: C.text3, fontSize: 12 }}>暂无截图预览，应用后在桌面查看效果</span>
              </div>
            )}

            {/* 通用无预览（仅图片/视频） */}
            {wallpaper.type !== 'html' && !previewUrl && (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: C.text3, fontSize: 16,
              }}>暂无预览</div>
            )}
          </div>

          {/* ---- 壁纸信息 ---- */}
          <div style={{
            marginTop: 20, padding: '16px 20px', background: C.card, borderRadius: 12,
            border: `1px solid ${C.borderLight}`,
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>
              {wallpaper.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 12, padding: '3px 12px', borderRadius: 6,
                background: typeBg, color: typeColor, fontWeight: 600,
              }}>{typeLabel}</span>
              {wallpaper.resolution && (
                <span style={{ fontSize: 12, color: C.text3 }}>分辨率: {wallpaper.resolution}</span>
              )}
              {wallpaper.duration != null && (
                <span style={{ fontSize: 12, color: C.text3 }}>时长: {wallpaper.duration}s</span>
              )}
              <span style={{ fontSize: 12, color: C.text3 }}>
                创建于: {new Date(wallpaper.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
            {wallpaper.tags && wallpaper.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {wallpaper.tags.map(tag => (
                  <span key={tag} style={{
                    padding: '3px 12px', borderRadius: 20, fontSize: 12,
                    background: 'rgba(108,92,231,0.12)', color: C.brandLight,
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============ 右侧：操作面板 ============ */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{
            padding: 20, background: C.card, borderRadius: 12,
            border: `1px solid ${C.borderLight}`,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <button onClick={handleApply} disabled={applying} style={{
              padding: '12px 20px', border: 'none', borderRadius: 10,
              cursor: applying ? 'not-allowed' : 'pointer',
              background: isActive ? 'rgba(225,112,85,0.2)' : C.brand,
              color: isActive ? C.error : '#fff', fontWeight: 600, fontSize: 15,
              opacity: applying ? 0.5 : 1, transition: 'all 0.2s',
            }}>
              {applying ? '操作中...' : isActive ? '取消壁纸' : '应用壁纸'}
            </button>
            {wallpaper.isAIGenerated && (
              <button onClick={() => navigate(`/generate?refine=${wallpaper.id}&type=${wallpaper.type}`)} style={{
                padding: '10px 20px', border: `1px solid rgba(108,92,231,0.4)`, borderRadius: 10,
                cursor: 'pointer', background: 'rgba(108,92,231,0.1)', color: C.brandLight, fontWeight: 500, fontSize: 14,
              }}>
                优化此壁纸
              </button>
            )}
            <button onClick={handleToggleFavorite} style={{
              padding: '10px 20px', border: `1px solid ${C.border}`, borderRadius: 10,
              cursor: 'pointer', background: 'transparent',
              color: wallpaper.isFavorite ? C.error : C.text2, fontWeight: 500, fontSize: 14,
            }}>
              {wallpaper.isFavorite ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button onClick={handleShowInFolder} style={{
              padding: '10px 20px', border: `1px solid ${C.border}`, borderRadius: 10,
              cursor: 'pointer', background: 'transparent', color: C.text2, fontWeight: 500, fontSize: 14,
            }}>
              打开文件所在目录
            </button>
            <button onClick={handleDelete} style={{
              padding: '10px 20px', border: `1px solid rgba(225,112,85,0.3)`, borderRadius: 10,
              cursor: 'pointer', background: 'transparent', color: C.error, fontWeight: 500, fontSize: 14,
            }}>
              删除壁纸
            </button>
          </div>

          {/* 推荐位（预留） */}
          <div style={{
            marginTop: 16, padding: 20, background: C.card, borderRadius: 12,
            border: `1px solid ${C.borderLight}`, textAlign: 'center', color: C.text3, fontSize: 13,
          }}>
            <div style={{ fontSize: 24, opacity: 0.3, marginBottom: 8 }}>🎨</div>
            <p style={{ margin: 0 }}>更多壁纸推荐</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.text3 }}>即将上线</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detail;
