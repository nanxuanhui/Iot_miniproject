import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/UserMenu.css';

const UserMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 如果未登录，不显示菜单
  if (!currentUser) {
    return null;
  }
  
  return (
    <div className="user-menu" ref={menuRef}>
      <div 
        className="user-menu-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="user-avatar">
          {currentUser.name.substring(0, 1).toUpperCase()}
        </div>
        <span className="user-name">{currentUser.name}</span>
        <i className={`arrow ${isOpen ? 'up' : 'down'}`}></i>
      </div>
      
      {isOpen && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <strong>{currentUser.name}</strong>
            <span className="user-role">{currentUser.role === 'admin' ? '管理员' : '用户'}</span>
          </div>
          
          <div className="dropdown-divider"></div>
          
          <div className="dropdown-item" onClick={() => navigate('/profile')}>
            <i className="icon-profile"></i>
            个人资料
          </div>
          
          <div className="dropdown-item" onClick={handleLogout}>
            <i className="icon-logout"></i>
            退出登录
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu; 