import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Input, Select, Button, Card, message, Space } from 'antd';
import {
  PictureOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ImageGenParams, HTMLGenParams, AIGeneration } from '../../shared/types';

const { TextArea } = Input;

declare global {
  interface Window {
    api: {
      ai: {
        generateImage: (params: ImageGenParams) => Promise<{ success: boolean; generation?: any; error?: string }>;
        generateHTML: (params: HTMLGenParams) => Promise<{ success: boolean; generation?: any; error?: string }>;
        getProviders: () => Promise<any[]>;
        getHistory: (limit?: number) => Promise<AIGeneration[]>;
        deleteHistory: (id: string) => Promise<{ success: boolean; error?: string }>;
      };
      wallpaper: {
        setImage: (id: string, style?: string) => Promise<{ success: boolean; error?: string }>;
        setHTML: (id: string) => Promise<{ success: boolean; error?: string }>;
      };
      library: {
        list: (filter?: any) => Promise<any[]>;
      };
      settings: {
        getAll: () => Promise<any>;
        set: (key: string, value: unknown) => Promise<{ success: boolean }>;
      };
      system: {
        getFileAsDataURL: (filePath: string) => Promise<string | null>;
      };
    };
  }
}

const C = {
  text: '#F0F0F5',
  text2: 'rgba(240,240,245,0.6)',
  text3: 'rgba(240,240,245,0.35)',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  brand: '#6C5CE7',
  brandLight: '#A29BFE',
  success: '#00B894',
  error: '#E17055',
};

const imageSizes = [
  { value: '1024x1024', label: '1024 x 1024 (方形)' },
  { value: '1792x1024', label: '1792 x 1024 (横屏)' },
  { value: '1024x1792', label: '1024 x 1792 (竖屏)' },
];

/** 图片生成平台预设 */
const imagePresets = [
  { name: 'Agnes AI', baseUrl: 'https://apihub.agnes-ai.com/v1', model: 'agnes-image-2.0-flash' },
  { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'black-forest-labs/FLUX.1-schnell' },
];

/** HTML 生成平台预设 */
const htmlPresets = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '智谱清言', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  { name: '月之暗面', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
];

const presetBtnStyle: React.CSSProperties = {
  padding: '3px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
  background: 'rgba(255,255,255,0.03)', color: C.text2,
  cursor: 'pointer', fontSize: 12, transition: 'all 0.2s',
};

const configCardStyle: React.CSSProperties = {
  background: 'rgba(108,92,231,0.06)', borderColor: 'rgba(108,92,231,0.15)',
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = { color: C.text3, fontSize: 11, marginBottom: 4 };

const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', color: C.text };

const Generate: React.FC = () => {
  const [searchParams] = useSearchParams();
  const refineId = searchParams.get('refine') || '';
  const refineType = searchParams.get('type') || '';

  const [activeTab, setActiveTab] = useState<'image' | 'html'>(refineType === 'image' ? 'image' : 'html');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [configReady, setConfigReady] = useState(false);

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState('1792x1024');

  // HTML generation state
  const [htmlDesc, setHtmlDesc] = useState('');
  const [htmlFeatures, setHtmlFeatures] = useState('');

  // Refine mode state
  const [refineMode, setRefineMode] = useState(!!refineId);
  const [refineWallpaperName, setRefineWallpaperName] = useState('');
  const [existingCode, setExistingCode] = useState('');

  // History state
  const [history, setHistory] = useState<AIGeneration[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // ── 图片接口配置 ──
  const [aiProvider, setAiProvider] = useState('custom');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiModel, setAiModel] = useState('');

  // ── HTML 接口配置 ──
  const [aiHtmlApiKey, setAiHtmlApiKey] = useState('');
  const [aiHtmlBaseUrl, setAiHtmlBaseUrl] = useState('');
  const [aiHtmlModel, setAiHtmlModel] = useState('');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 防抖保存 */
  const debouncedSave = useCallback((key: string, value: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.api.settings.set(key, value).then(() => message.success('已保存', 1));
    }, 400);
  }, []);

  const updateConfig = (setter: React.Dispatch<React.SetStateAction<string>>, key: string, value: string) => {
    setter(value);
    debouncedSave(key, value);
  };

  /** 加载配置 */
  useEffect(() => {
    window.api.settings.getAll().then(s => {
      if (s) {
        setAiProvider(s.aiProvider || 'custom');
        setAiApiKey(s.aiApiKey || '');
        setAiBaseUrl(s.aiBaseUrl || '');
        setAiModel(s.aiModel || '');
        setAiHtmlApiKey(s.aiHtmlApiKey || '');
        setAiHtmlBaseUrl(s.aiHtmlBaseUrl || '');
        setAiHtmlModel(s.aiHtmlModel || '');
      }
      setConfigReady(true);
    }).catch(() => setConfigReady(true));
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  /** 加载生成历史 */
  const loadHistory = useCallback(async () => {
    try {
      const records = await window.api.ai.getHistory(30);
      setHistory(records);
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  /** 优化模式：从详情页进入时加载原始壁纸信息 */
  useEffect(() => {
    if (!refineId) return;

    (async () => {
      try {
        const list = await window.api.library.list({});
        const wp = list.find((w: any) => w.id === refineId);
        if (!wp) return;

        setRefineWallpaperName(wp.name);

        if (wp.type === 'html') {
          // 读取 HTML 源文件内容
          const fp = wp.filePath.replace(/\\/g, '/');
          const entryPath = /\.html?$/i.test(fp) ? fp : `${fp}/index.html`;
          try {
            const resp = await fetch(`file:///${entryPath}`);
            if (resp.ok) {
              const code = await resp.text();
              setExistingCode(code);
            }
          } catch {
            console.warn('Failed to read HTML file for refine mode');
          }
          setHtmlDesc(wp.name.replace(/^AI:\s*/, ''));
          setActiveTab('html');
        } else if (wp.type === 'image') {
          setImagePrompt(wp.name.replace(/^AI:\s*/, ''));
          setActiveTab('image');
        }
      } catch (err) {
        console.error('Failed to load wallpaper for refine:', err);
      }
    })();
  }, [refineId]);

  const applyImagePreset = (p: typeof imagePresets[0]) => {
    updateConfig(setAiBaseUrl, 'aiBaseUrl', p.baseUrl);
    updateConfig(setAiModel, 'aiModel', p.model);
    message.success(`图片生成已切换为${p.name}`);
  };

  const applyHtmlPreset = (p: typeof htmlPresets[0]) => {
    updateConfig(setAiHtmlBaseUrl, 'aiHtmlBaseUrl', p.baseUrl);
    updateConfig(setAiHtmlModel, 'aiHtmlModel', p.model);
    message.success(`HTML 生成已切换为${p.name}`);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) { message.warning('请输入描述'); return; }
    setGenerating(true);
    setResult(null);
    try {
      const [w, h] = imageSize.split('x').map(Number);
      const res = await window.api.ai.generateImage({ prompt: imagePrompt.trim(), width: w, height: h });
      if (res.success && res.generation) {
        setResult(res.generation);
        message.success('图片生成成功！');
        loadHistory();
      } else {
        message.error(res.error || '生成失败');
      }
    } catch (err) { message.error(`生成失败: ${String(err)}`); }
    finally { setGenerating(false); }
  };

  const handleGenerateHTML = async () => {
    if (!htmlDesc.trim()) { message.warning('请输入描述'); return; }
    setGenerating(true);
    setResult(null);
    try {
      const features = htmlFeatures.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
      const params: HTMLGenParams = {
        description: htmlDesc.trim(),
        features: features.length > 0 ? features : undefined,
      };
      // 优化模式：传入原始 HTML 代码
      if (refineMode && existingCode) {
        params.existingCode = existingCode;
      }
      const res = await window.api.ai.generateHTML(params);
      if (res.success && res.generation) {
        setResult(res.generation);
        message.success('HTML 壁纸生成成功！');
        loadHistory();
      } else {
        message.error(res.error || '生成失败');
      }
    } catch (err) { message.error(`生成失败: ${String(err)}`); }
    finally { setGenerating(false); }
  };

  const handleSetAsWallpaper = async () => {
    if (!result?.wallpaperId) return;
    try {
      const res = result.type === 'image'
        ? await window.api.wallpaper.setImage(result.wallpaperId, 'fill')
        : await window.api.wallpaper.setHTML(result.wallpaperId);
      if (res.success) message.success('已设为壁纸');
      else message.error(res.error || '设置失败');
    } catch (err) { message.error(`设置失败: ${String(err)}`); }
  };

  /** 删除历史记录 */
  const handleDeleteHistory = async (id: string) => {
    try {
      const res = await window.api.ai.deleteHistory(id);
      if (res.success) {
        setHistory(prev => prev.filter(h => h.id !== id));
        message.success('已删除');
      } else {
        message.error(res.error || '删除失败');
      }
    } catch (err) {
      message.error(`删除失败: ${String(err)}`);
    }
  };

  const exitRefineMode = () => {
    setRefineMode(false);
    setRefineWallpaperName('');
    setExistingCode('');
    setHtmlDesc('');
    window.location.hash = '#/generate';
  };

  if (!configReady) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.text2 }}>加载中...</div>;
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720 }}>
      <h2 style={{ color: C.text, fontSize: 22, fontWeight: 600, margin: '0 0 24px',
        background: 'linear-gradient(135deg, #F0F0F5, #6C5CE7)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        AI 生成
      </h2>

      {/* 优化模式横幅 */}
      {refineMode && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 10,
          background: 'rgba(108,92,231,0.12)', border: '1px solid rgba(108,92,231,0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <EditOutlined style={{ color: C.brandLight, fontSize: 16 }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>
              优化模式：{refineWallpaperName}
            </div>
            <div style={{ color: C.text3, fontSize: 11, marginTop: 2 }}>
              修改描述后重新生成，AI 将基于原始代码进行优化
            </div>
          </div>
          <button onClick={exitRefineMode} style={{
            padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 12,
          }}>退出</button>
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as 'image' | 'html'); setResult(null); }}
        items={[
          /* ════════ 图片生成 Tab ════════ */
          {
            key: 'image',
            label: <span><PictureOutlined /> 图片生成</span>,
            children: (
              <div>
                {/* 接口配置 */}
                <Card size="small" style={configCardStyle} styles={{ body: { padding: '14px 18px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <PictureOutlined style={{ color: C.brandLight, fontSize: 14 }} />
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>接口配置</span>
                    <span style={{ color: C.text3, fontSize: 11 }}>/images/generations</span>
                    <span style={{ color: C.text3, fontSize: 11, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <InfoCircleOutlined />
                      需要文生图模型（DALL-E、FLUX 等），纯文本 LLM 无法生图
                    </span>
                  </div>

                  {/* 平台预设 */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {imagePresets.map(p => (
                      <button key={p.name} onClick={() => applyImagePreset(p)} style={presetBtnStyle}
                        onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = C.brand; (e.target as HTMLElement).style.color = C.text; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = C.border; (e.target as HTMLElement).style.color = C.text2; }}>
                        {p.name}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 120 }}>
                      <div style={labelStyle}>Provider</div>
                      <Select value={aiProvider} size="small"
                        onChange={v => updateConfig(setAiProvider, 'aiProvider', v)}
                        options={[
                          { value: 'openai', label: 'OpenAI' },
                          { value: 'anthropic', label: 'Anthropic' },
                          { value: 'custom', label: '自定义' },
                        ]}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>API Key</div>
                      <Input.Password value={aiApiKey} size="small"
                        onChange={e => updateConfig(setAiApiKey, 'aiApiKey', e.target.value)}
                        placeholder="sk-..." style={inputStyle}
                        prefix={<KeyOutlined style={{ color: C.text3, fontSize: 12 }} />}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Base URL</div>
                      <Input value={aiBaseUrl} size="small"
                        onChange={e => updateConfig(setAiBaseUrl, 'aiBaseUrl', e.target.value)}
                        placeholder="https://api.openai.com/v1" style={inputStyle}
                        prefix={<LinkOutlined style={{ color: C.text3, fontSize: 12 }} />}
                      />
                    </div>
                    <div style={{ width: 180 }}>
                      <div style={labelStyle}>模型</div>
                      <Input value={aiModel} size="small"
                        onChange={e => updateConfig(setAiModel, 'aiModel', e.target.value)}
                        placeholder="dall-e-3" style={inputStyle}
                        prefix={<ThunderboltOutlined style={{ color: C.text3, fontSize: 12 }} />}
                      />
                    </div>
                  </div>
                </Card>

                {/* 生成表单 */}
                <Card size="small" style={{ background: C.card, borderColor: C.border, marginBottom: 16 }}
                  styles={{ body: { padding: 20 } }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: C.text2, fontSize: 13, marginBottom: 8 }}>描述你想生成的壁纸</div>
                    <TextArea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)}
                      placeholder="例如：赛博朋克风格的城市夜景，霓虹灯闪烁，雨夜街道，4K画质"
                      rows={4} style={{ ...inputStyle, borderColor: C.border }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: C.text2, fontSize: 13, marginBottom: 8 }}>图片尺寸</div>
                    <Select value={imageSize} onChange={setImageSize} options={imageSizes}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', color: C.text }} />
                  </div>
                  <Button type="primary" onClick={handleGenerateImage} loading={generating}
                    icon={<ThunderboltOutlined />} block
                    style={{ background: C.brand, borderColor: C.brand, height: 44, fontSize: 15 }}>
                    {generating ? '生成中（约 30-60 秒）...' : '生成图片壁纸'}
                  </Button>
                </Card>
              </div>
            ),
          },

          /* ════════ HTML 生成 Tab ════════ */
          {
            key: 'html',
            label: <span><CodeOutlined /> HTML 生成</span>,
            children: (
              <div>
                {/* 接口配置 */}
                <Card size="small" style={configCardStyle} styles={{ body: { padding: '14px 18px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <CodeOutlined style={{ color: C.brandLight, fontSize: 14 }} />
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>接口配置</span>
                    <span style={{ color: C.text3, fontSize: 11 }}>/chat/completions</span>
                    <span style={{ color: C.text3, fontSize: 11, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <InfoCircleOutlined />
                      需要 LLM（DeepSeek、GPT-4o、GLM-4 等），文生图模型无法生成代码
                    </span>
                  </div>

                  {/* 平台预设 */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {htmlPresets.map(p => (
                      <button key={p.name} onClick={() => applyHtmlPreset(p)} style={presetBtnStyle}
                        onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = C.brand; (e.target as HTMLElement).style.color = C.text; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = C.border; (e.target as HTMLElement).style.color = C.text2; }}>
                        {p.name}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>API Key</div>
                      <Input.Password value={aiHtmlApiKey} size="small"
                        onChange={e => updateConfig(setAiHtmlApiKey, 'aiHtmlApiKey', e.target.value)}
                        placeholder="sk-...（留空则使用图片生成的 API Key）" style={inputStyle}
                        prefix={<KeyOutlined style={{ color: C.text3, fontSize: 12 }} />}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Base URL（留空使用图片生成的 URL）</div>
                      <Input value={aiHtmlBaseUrl} size="small"
                        onChange={e => updateConfig(setAiHtmlBaseUrl, 'aiHtmlBaseUrl', e.target.value)}
                        placeholder="https://api.deepseek.com/v1" style={inputStyle}
                        prefix={<LinkOutlined style={{ color: C.text3, fontSize: 12 }} />}
                      />
                    </div>
                    <div style={{ width: 180 }}>
                      <div style={labelStyle}>模型</div>
                      <Input value={aiHtmlModel} size="small"
                        onChange={e => updateConfig(setAiHtmlModel, 'aiHtmlModel', e.target.value)}
                        placeholder="deepseek-chat" style={inputStyle}
                        prefix={<ThunderboltOutlined style={{ color: C.text3, fontSize: 12 }} />}
                      />
                    </div>
                  </div>
                </Card>

                {/* 生成表单 */}
                <Card size="small" style={{ background: C.card, borderColor: C.border, marginBottom: 16 }}
                  styles={{ body: { padding: 20 } }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: C.text2, fontSize: 13, marginBottom: 8 }}>
                      {refineMode ? '描述你想修改的内容' : '描述你想要的动态壁纸效果'}
                    </div>
                    <TextArea value={htmlDesc} onChange={e => setHtmlDesc(e.target.value)}
                      placeholder={refineMode
                        ? '例如：颜色改成深蓝色调，增加更多流星效果'
                        : '例如：深蓝色宇宙背景，缓慢旋转的星云，偶尔划过的流星，带有微妙的粒子效果'}
                      rows={4} style={{ ...inputStyle, borderColor: C.border }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: C.text2, fontSize: 13, marginBottom: 8 }}>特效要求（可选，逗号分隔）</div>
                    <Input value={htmlFeatures} onChange={e => setHtmlFeatures(e.target.value)}
                      placeholder="例如：粒子效果, 渐变动画, 鼠标交互"
                      style={{ ...inputStyle, borderColor: C.border }} />
                  </div>
                  {refineMode && existingCode && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: C.text3, fontSize: 11, marginBottom: 4 }}>原始代码（AI 将基于此代码修改）</div>
                      <div style={{
                        padding: '8px 12px', borderRadius: 6, maxHeight: 80, overflow: 'hidden',
                        background: 'rgba(0,0,0,0.3)', color: C.text3, fontSize: 11,
                        fontFamily: 'monospace', lineHeight: 1.4,
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        {existingCode.slice(0, 200)}{existingCode.length > 200 ? '...' : ''}
                      </div>
                    </div>
                  )}
                  <Button type="primary" onClick={handleGenerateHTML} loading={generating}
                    icon={<ThunderboltOutlined />} block
                    style={{ background: C.brand, borderColor: C.brand, height: 44, fontSize: 15 }}>
                    {generating ? '生成中（约 30-60 秒）...' : refineMode ? '优化生成 HTML 壁纸' : '生成 HTML 壁纸'}
                  </Button>
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* 生成结果 */}
      {result && (
        <Card size="small" style={{ background: C.card, borderColor: C.border, marginTop: 16 }}
          styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {result.status === 'success' ? (
              <CheckCircleOutlined style={{ color: C.success, fontSize: 18 }} />
            ) : (
              <CloseCircleOutlined style={{ color: C.error, fontSize: 18 }} />
            )}
            <span style={{ color: C.text, fontWeight: 500 }}>
              {result.status === 'success' ? '生成成功' : '生成失败'}
            </span>
          </div>
          {result.status === 'success' && result.wallpaperId && (
            <Space>
              <Button type="primary" onClick={handleSetAsWallpaper}
                style={{ background: C.brand, borderColor: C.brand }}>
                设为壁纸
              </Button>
            </Space>
          )}
          {result.errorMessage && (
            <div style={{ color: C.error, fontSize: 13, marginTop: 8 }}>{result.errorMessage}</div>
          )}
        </Card>
      )}

      {/* 生成历史 */}
      {historyLoaded && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>生成历史</span>
            <span style={{ color: C.text3, fontSize: 12, marginLeft: 8 }}>({history.length})</span>
          </div>

          {history.length === 0 ? (
            <div style={{
              padding: '24px', textAlign: 'center', color: C.text3, fontSize: 13,
              background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
            }}>
              暂无生成记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map(record => (
                <div key={record.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8,
                  background: C.card, border: `1px solid ${C.border}`,
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card as string; }}
                >
                  {/* 类型标签 */}
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                    background: record.type === 'image' ? 'rgba(0,184,148,0.15)' : 'rgba(108,92,231,0.15)',
                    color: record.type === 'image' ? C.success : C.brandLight,
                  }}>
                    {record.type === 'image' ? '图片' : 'HTML'}
                  </span>

                  {/* 提示词摘要 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: C.text, fontSize: 13, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {record.prompt}
                    </div>
                    <div style={{ color: C.text3, fontSize: 11, marginTop: 2 }}>
                      {new Date(record.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                      {record.status === 'success' && (
                        <span style={{ color: C.success, marginLeft: 8 }}>成功</span>
                      )}
                      {record.status === 'failed' && (
                        <span style={{ color: C.error, marginLeft: 8 }}>失败</span>
                      )}
                      {record.status === 'pending' && (
                        <span style={{ color: C.text3, marginLeft: 8 }}>进行中</span>
                      )}
                    </div>
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleDeleteHistory(record.id)}
                    title="删除记录"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.text3, fontSize: 14, padding: '4px',
                      display: 'flex', alignItems: 'center',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.error; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.text3; }}
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Generate;
