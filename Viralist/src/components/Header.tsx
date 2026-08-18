import React, { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  user: { name: string; email: string; avatar: string; subscription_tier: string; subscription_status: string };
  onLogout: () => void;
  onDevSetTier?: (tier: 'free' | 'pro' | 'agency') => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onDevSetTier }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="app-header" ref={dropdownRef}>
      {/* Left side: Brand Logo & Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <img src="/logo.png" alt="Viralize" width={28} style={{ height: 'auto', display: 'block' }} />
        <span style={{ 
          fontFamily: 'var(--font-display)', 
          fontWeight: 800, 
          fontSize: '1.3rem',
          background: 'linear-gradient(90deg, var(--text-primary) 30%, var(--text-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Viralize
        </span>
      </div>

      {/* Right side: Profile Dropdown Menu */}
      <div className="profile-container">
        <div style={{ position: 'relative' }}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="avatar-trigger"
              onClick={() => setIsOpen(!isOpen)}
              id="avatar-trigger-btn"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div 
            className="avatar-trigger"
            onClick={() => setIsOpen(!isOpen)}
            style={{ 
              display: user.avatar ? 'none' : 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: 'var(--color-primary)', 
              color: 'white', 
              fontWeight: 'bold', 
              fontSize: '1.2rem',
              textTransform: 'uppercase'
            }}
          >
            {user.name ? user.name.charAt(0) : 'U'}
          </div>
        </div>

        {isOpen && (
          <div className="profile-dropdown glass-panel" style={{ right: 0, left: 'auto' }}>
            <div className="profile-dropdown-info">
              <span className="profile-dropdown-name">{user.name}</span>
              <span className="profile-dropdown-email">{user.email}</span>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--color-primary)', color: '#fff', fontWeight: 'bold' }}>
                  {user.subscription_tier}
                </span>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: '4px', background: user.subscription_status === 'active' ? '#10b981' : '#f43f5e', color: '#fff', fontWeight: 'bold' }}>
                  {user.subscription_status}
                </span>
              </div>
            </div>

            {onDevSetTier && (
              <div style={{ padding: '0.6rem 0', borderTop: '1px dashed var(--border-glass)', borderBottom: '1px dashed var(--border-glass)', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Set Tier (Demo)</span>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem' }}>
                  {(['free', 'pro', 'agency'] as const).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => onDevSetTier(tier)}
                      style={{
                        flex: 1,
                        fontSize: '0.7rem',
                        textTransform: 'capitalize',
                        padding: '0.3rem 0.4rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-glass)',
                        background: user.subscription_tier === tier ? 'var(--color-primary)' : 'transparent',
                        color: user.subscription_tier === tier ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="btn btn-secondary profile-dropdown-logout"
              style={{ color: 'var(--color-accent)' }}
              onClick={onLogout}
              id="signout-btn"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
