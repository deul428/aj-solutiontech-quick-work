import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DashboardSection, DashboardMenuItem, colorClasses } from '../config/dashboardConfig';
import Header from './Header';
import { getCurrentUser, getUiRole, isOrderingAdmin, isAuditAdmin } from '../utils/orderingAuth';

interface DashboardPageProps {
  sections: DashboardSection[];
  headerTitle: string;
  userRole?: 'manager' | 'user';
  userName?: string;
  userTeam?: string;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  sections,
  headerTitle,
  userRole,
  userName,
  userTeam
}) => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const uiRole = userRole ?? getUiRole(currentUser);
  const userIsOrderingAdmin = isOrderingAdmin(currentUser);
  const userIsAuditAdmin = isAuditAdmin(currentUser);

  const accessCtx = {
    user: currentUser,
    uiRole,
    isOrderingAdmin: userIsOrderingAdmin,
    isAuditAdmin: userIsAuditAdmin,
  } as const;

  const canAccessMenu = (menu: DashboardMenuItem) => {
    if (menu.hidden) return false;

    // 역할이 지정되지 않은 메뉴는 표시(레거시 호환)
    if (!menu.roles || menu.roles.length === 0) return true;

    // 역할은 명시적으로 분리: manager는 user를 자동 포함하지 않음
    return menu.roles.includes(uiRole);
  };

  const MenuCard: React.FC<{
    menu: DashboardMenuItem;
  }> = ({ menu }) => {
    const colors = colorClasses[menu.color as keyof typeof colorClasses];
    const Icon = menu.icon;
    const isDisabled =
      menu.disabled === true ||
      (typeof menu.disabledWhen === 'function' ? menu.disabledWhen(accessCtx) : false);

    // ArrowRight 아이콘 색상 클래스 매핑
    const arrowColorMap: Record<string, string> = {
      blue: 'group-hover:text-blue-600',
      green: 'group-hover:text-green-600',
      purple: 'group-hover:text-purple-600',
      orange: 'group-hover:text-orange-600',
      indigo: 'group-hover:text-indigo-600',
      red: 'group-hover:text-red-600',
      pink: 'group-hover:text-pink-600',
      yellow: 'group-hover:text-yellow-600'
    };

    const handleClick = () => {
      if (!isDisabled) {
        navigate(menu.path);
      }
    };

    return (
      <div
        onClick={handleClick}
        className={`p-8 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 relative overflow-hidden flex-1 transition-all ${isDisabled
            ? 'opacity-50 cursor-not-allowed grayscale'
            : `cursor-pointer group ${colors.shadow}`
          }`}
      >
        <div className={`absolute top-0 right-0 w-32 h-32 ${colors.accent} rounded-bl-[5rem] -mr-10 -mt-10 ${!isDisabled && 'group-hover:scale-110'} transition-transform`}></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className={`${colors.bg} p-4 rounded-3xl ${!isDisabled && colors.hover} transition-colors shadow-inner ${colors.text} ${!isDisabled && 'group-hover:text-white'} duration-500`}>
            <Icon className="w-10 h-10" />
          </div>
          {!isDisabled && (
            <ArrowRight className={`w-8 h-8 text-gray-200 ${arrowColorMap[menu.color]} transition-transform group-hover:translate-x-2`} />
          )}
        </div>
        <h3 className={`text-2xl font-black mb-3 relative z-10 ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
          {menu.title}
          {isDisabled && <span className="ml-2 text-sm text-gray-400">(비활성화)</span>}
        </h3>
        <p className={`text-sm leading-relaxed font-bold text-pretty relative z-10 ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
          {menu.description}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-12 px-4 md:px-6">
      {/* 헤더 */}
      <Header headerTitle={headerTitle} headerSubTitle="AJ솔루션테크" level={1} />

      <div className='grid grid-cols-1 md:grid-cols-4 gap-6 w-full'>
        {sections.flatMap(section =>
          section.menus
            .filter(canAccessMenu)
            .map(menu => (
              <MenuCard key={menu.id} menu={menu} />
            ))
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

