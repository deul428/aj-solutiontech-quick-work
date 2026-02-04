import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { navbarMenuItems, NavbarMenuItem } from '../config/dashboardConfig';
import { isAdmin, isUser, isLoggedIn, getCurrentUser, logout } from '../utils/orderingAuth';

interface NavbarProps {
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentUser = getCurrentUser();
  const userIsAdmin = isAdmin(currentUser);
  const userIsUser = isUser(currentUser);
  const isUserLoggedIn = isLoggedIn();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // 메뉴 아이템이 표시되어야 하는지 확인
  const shouldShowMenuItem = (item: NavbarMenuItem): boolean => {
    if (item.hidden) return false;

    if (!item.roles || item.roles.length === 0) return true;

    // 로그인 상태 확인
    const loggedIn = isUserLoggedIn;

    // 역할별 필터링
    for (const role of item.roles) {
      if (role === 'guest' && !loggedIn) return true;
      if (role === 'all' && loggedIn) return true;
      if (role === 'console' && loggedIn && userIsAdmin) return true;
      if (role === 'user' && loggedIn && userIsUser) return true;
    }

    return false;
  };

  // 활성화 상태 확인
  const isActive = (item: NavbarMenuItem): boolean => {
    if (item.activePath) {
      return location.pathname.startsWith(item.activePath);
    }
    return location.pathname === item.path;
  };

  // 메뉴 클릭 핸들러
  const handleMenuClick = (item: NavbarMenuItem) => {
    if (item.isLogout) {
      if (window.confirm('정말 로그아웃하시겠습니까?')) {
        logout();
        if (onLogout) {
          onLogout();
          navigate('/');
        }
      }
      setIsMenuOpen(false);
      return;
    }

    if (item.isLogin) {
      navigate(item.path, { state: { from: location.pathname } });
      setIsMenuOpen(false);
      return;
    }

    navigate(item.path);
    setIsMenuOpen(false);
  };

  // 필터링된 메뉴 아이템
  const visibleMenuItems = navbarMenuItems.filter(shouldShowMenuItem);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:justify-center">
          {/* Desktop Menu */}
          <div className="hidden sm:ml-6 sm:flex sm:space-x-4 items-center">
            {visibleMenuItems.map((item, idx) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active
                    ? "bg-blue-50 text-blue-700"
                    : item.isLogout
                      ? "text-gray-500 hover:text-red-600 hover:bg-gray-50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </button>
              );
            })}
          </div>
          {/* Mobile Menu Button */}
          <div className="flex items-center sm:hidden gap-4">
            <button onClick={toggleMenu} className="p-2 text-gray-500">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100 px-2 pt-2 pb-3 space-y-1 shadow-lg">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-base font-medium rounded-lg transition-colors ${active
                  ? "bg-blue-50 text-blue-700"
                  : item.isLogout
                    ? "text-red-600 hover:bg-red-50"
                    : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                <Icon className="w-5 h-5" /> {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default Navbar;

