import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 监听窗口最大化状态变化
    const handleResize = () => {
      // 通过 window.matchMedia 检测是否全屏
      setIsMaximized(window.matchMedia('(display-mode: fullscreen)').matches);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMinimize = () => {
    // 通过 IPC 调用主进程最小化
    (window as any).api?.system?.minimize?.();
  };

  const handleMaximize = () => {
    (window as any).api?.system?.maximize?.();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    (window as any).api?.system?.close?.();
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="最小化">
          <Minus size={14} />
        </button>
        <button className="titlebar-btn" onClick={handleMaximize} title={isMaximized ? '还原' : '最大化'}>
          <Square size={12} />
        </button>
        <button className="titlebar-btn titlebar-btn-close" onClick={handleClose} title="关闭">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
