import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DashboardSection, DashboardMenuItem, colorClasses } from '../config/dashboardConfig';
import Header from './Header';

interface DashboardPageProps {
  sections: DashboardSection[];
  headerTitle: string;
  userRole: 'console' | 'user';
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

  const MenuCard: React.FC<{
    menu: DashboardMenuItem;
  }> = ({ menu }) => {
    const colors = colorClasses[menu.color as keyof typeof colorClasses];
    const Icon = menu.icon;

    // ArrowRight 아이콘 색상 클래스 매핑
    const arrowColorMap: Record<string, string> = {
      blue: 'group-hover:text-blue-600',
      green: 'group-hover:text-green-600',
      purple: 'group-hover:text-purple-600',
      orange: 'group-hover:text-orange-600',
      indigo: 'group-hover:text-indigo-600',
      red: 'group-hover:text-red-600'
    };

    return (
      <div
        onClick={() => navigate(menu.path)}
        className={`p-8 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group ${colors.shadow} transition-all relative overflow-hidden `}
      >
        <div className={`absolute top-0 right-0 w-32 h-32 ${colors.accent} rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform`}></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className={`${colors.bg} p-4 rounded-3xl ${colors.hover} transition-colors  shadow-inner ${colors.text} group-hover:text-white duration-500`}>
            <Icon className="w-10 h-10" />
          </div>
          <ArrowRight className={`w-8 h-8 text-gray-200 ${arrowColorMap[menu.color]} transition-transform group-hover:translate-x-2`} />
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">{menu.title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">{menu.description}</p>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-12 px-4 md:px-6">
      {/* 헤더 */}
      <Header headerTitle={headerTitle} headerSubTitle="AJ솔루션테크" level={1} />

      {/* 섹션별 메뉴 렌더링 */}
      {sections.map((section) => {
        const titleColors = colorClasses[section.titleColor];
        const gridCols = section.gridCols || '3';

        /*     // Tailwind 동적 클래스 매핑
            const gridColsClass = {
              '1': 'md:grid-cols-1',
              '2': 'md:grid-cols-2',
              '3': 'md:grid-cols-3'
            }[gridCols] || 'md:grid-cols-3';
     */
        return (
          <div key={section.id} className="mb-12">
            <h3 className="text-[1.3rem] sm:text-2xl font-black text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
              <div className={`w-1 h-8 ${titleColors.titleBar} rounded-full`}></div>
              {section.title}
            </h3>
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6`}>
              {section.menus
                .filter(menu => !menu.hidden && (!menu.roles || menu.roles.includes(userRole) || menu.roles.includes('all')))
                .map((menu) => (
                  <MenuCard key={menu.id} menu={menu} />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardPage;

