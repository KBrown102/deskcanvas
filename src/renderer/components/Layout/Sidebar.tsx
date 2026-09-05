import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Sparkles,
  Heart,
  Settings,
  Image,
} from 'lucide-react';

const menuItems = [
  { path: '/gallery', label: '画廊', icon: LayoutGrid },
  { path: '/generate', label: 'AI 生成', icon: Sparkles },
  { path: '/favorites', label: '收藏', icon: Heart },
  { path: '/settings', label: '设置', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Image size={24} color="#6C5CE7" />
        <span className="sidebar-logo-text">DeskCanvas</span>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
