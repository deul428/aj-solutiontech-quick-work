import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { navbarMenuItems, NavbarMenuItem } from '../config/dashboardConfig';
import { isAdmin, isUser, isLoggedIn, getCurrentUser, logout } from '../utils/orderingAuth';
import Button from './Button';

interface NavbarProps {
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [userIsAdmin, setUserIsAdmin] = useState(isAdmin(currentUser));
  const [userIsUser, setUserIsUser] = useState(isUser(currentUser));
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(isLoggedIn());

  // location이 변경될 때마다 사용자 정보를 다시 가져오기
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setUserIsAdmin(isAdmin(user));
    setUserIsUser(isUser(user));
    setIsUserLoggedIn(isLoggedIn());
  }, [location.pathname]);

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
              // 'info' 메뉴인 경우 동적으로 사용자 정보 표시
              const displayLabel = item.id === 'info' && currentUser
                ? `${currentUser.name} (${currentUser.team})`
                : item.label;

              return (
                <Button variant="" onClick={() => handleMenuClick(item)}
                  key={item.id}
                  className={` ${active
                    ? "bg-blue-50 text-blue-700"
                    : item.isLogout
                      ? "text-gray-500 hover:text-red-600 hover:bg-gray-50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  <Icon className="w-4 h-4" /> {displayLabel}
                </Button>
              );
            })}
          </div>
          {/* Mobile Menu Button */}
          <div className="flex items-center sm:hidden gap-4">
            <Button variant="icon" onClick={toggleMenu} className="p-2">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100 px-2 pt-2 pb-3 space-y-1 shadow-lg">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            // 'info' 메뉴인 경우 동적으로 사용자 정보 표시
            const displayLabel = item.id === 'info' && currentUser
              ? `${currentUser.name} (${currentUser.team})`
              : item.label;

            return (
              <Button
                fullWidth
                key={item.id}
                size="lg"
                variant=""
                onClick={() => handleMenuClick(item)}
                className={` justify-start transition-colors ${active
                  ? "bg-blue-50 text-blue-700"
                  : item.isLogout
                    ? "text-red-600 hover:bg-red-50"
                    : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                <Icon className="w-5 h-5" /> {displayLabel}
              </Button>
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default Navbar;

