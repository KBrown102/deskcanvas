import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Sidebar } from './components/Layout/Sidebar';
import { TitleBar } from './components/Layout/TitleBar';
import CloseDialog from './components/CloseDialog';
import Gallery from './pages/Gallery';
import Generate from './pages/Generate';
import Favorites from './pages/Favorites';
import Settings from './pages/Settings';
import Detail from './pages/Detail';
import './styles/global.css';

// 消息提示需要在标题栏（36px）下方显示，避免被遮挡
message.config({ top: 44 });

export default function App() {
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  useEffect(() => {
    const handler = () => setShowCloseDialog(true);
    window.api.system.onCloseDialog?.(handler);
    return () => window.api.system.offCloseDialog?.(handler);
  }, []);

  const handleCloseResponse = useCallback(async (action: 'tray' | 'quit' | 'cancel', remember: boolean) => {
    setShowCloseDialog(false);
    await window.api.system.sendCloseResponse?.(action, remember);
  }, []);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6C5CE7',
          colorBgBase: '#0F0F1A',
          colorBgContainer: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 12,
          fontFamily: "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
        },
      }}
    >
      <div className="app-container">
        <TitleBar />
        <div className="app-body">
          <Sidebar />
          <main className="app-content">
            <Routes>
              <Route path="/" element={<Gallery />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/generate" element={<Generate />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/detail/:id" element={<Detail />} />
            </Routes>
          </main>
        </div>
        <CloseDialog open={showCloseDialog} onResponse={handleCloseResponse} />
      </div>
    </ConfigProvider>
  );
}
