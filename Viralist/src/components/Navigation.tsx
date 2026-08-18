import React from 'react';
import { LayoutDashboard, PenTool, Calendar, Settings } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="floating-capsule-nav">
      <button
        className={`floating-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        <LayoutDashboard size={18} />
        <span>Dashboard</span>
      </button>

      <button
        className={`floating-nav-btn ${activeTab === 'creator' ? 'active' : ''}`}
        onClick={() => setActiveTab('creator')}
      >
        <PenTool size={18} />
        <span>AI Brief Creator</span>
      </button>

      <button
        className={`floating-nav-btn ${activeTab === 'scheduler' ? 'active' : ''}`}
        onClick={() => setActiveTab('scheduler')}
      >
        <Calendar size={18} />
        <span>Scheduler</span>
      </button>

      <button
        className={`floating-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveTab('settings')}
      >
        <Settings size={18} />
        <span>Settings</span>
      </button>
    </div>
  );
};
