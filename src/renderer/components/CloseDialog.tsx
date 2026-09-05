import React, { useState, useEffect } from 'react';

const C = {
  bg: 'rgba(0,0,0,0.55)',
  card: 'rgba(28,28,50,0.96)',
  border: 'rgba(255,255,255,0.1)',
  text: '#F0F0F5',
  text2: 'rgba(240,240,245,0.6)',
  brand: '#6C5CE7',
  brandLight: '#A29BFE',
  danger: '#E17055',
};

interface CloseDialogProps {
  open: boolean;
  onResponse: (action: 'tray' | 'quit' | 'cancel', remember: boolean) => void;
}

/**
 * 关闭窗口确认弹窗（匹配 app 暗色主题风格）
 * 由主进程 close 事件触发，渲染在 app 最上层
 */
const CloseDialog: React.FC<CloseDialogProps> = ({ open, onResponse }) => {
  const [remember, setRemember] = useState(false);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onResponse('cancel', false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onResponse]);

  if (!open) return null;

  const btnBase: React.CSSProperties = {
    padding: '10px 0', border: 'none', borderRadius: 10,
    cursor: 'pointer', fontSize: 14, fontWeight: 500,
    transition: 'all 0.15s', width: '100%',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: C.card, borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: '28px 32px', width: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: C.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          关闭 DeskCanvas
        </div>
        <div style={{ color: C.text2, fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
          关闭窗口后，壁纸将继续在桌面显示。
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => onResponse('tray', remember)}
            style={{ ...btnBase, background: 'rgba(108,92,231,0.2)', color: C.brandLight }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,92,231,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(108,92,231,0.2)')}
          >
            最小化到托盘
          </button>
          <button
            onClick={() => onResponse('quit', remember)}
            style={{ ...btnBase, background: 'rgba(225,112,85,0.15)', color: C.danger }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(225,112,85,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(225,112,85,0.15)')}
          >
            退出程序
          </button>
          <button
            onClick={() => onResponse('cancel', false)}
            style={{ ...btnBase, background: 'rgba(255,255,255,0.05)', color: C.text2 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            取消
          </button>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 18, cursor: 'pointer', color: C.text2, fontSize: 12,
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            style={{ accentColor: C.brand, width: 14, height: 14 }}
          />
          记住我的选择，不再询问
        </label>
      </div>
    </div>
  );
};

export default CloseDialog;
