import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdmin, isUser, getCurrentUser } from '../utils/orderingAuth';
import LoadingOverlay from '../components/LoadingOverlay';
import { DashboardSection, DashboardMenuItem, colorClasses } from '../config/dashboardConfig';
import Header from '../components/Header';
import { ArrowRight, ClipboardCheck, FileText, RefreshCcw, ScanQrCode } from 'lucide-react';

const EquipmentMainPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userIsAdmin = useMemo(() => user && isAdmin(user), [user?.role]);
  const userIsUser = useMemo(() => user && isUser(user), [user?.role]);

  // 장비 시스템 섹션만 필터링
  const equipmentSections: DashboardSection[] = [
    {
      id: 'equipment',
      title: '장비 점검, 실사, QR생성 시스템',
      titleColor: 'blue',
      gridCols: '3',
      menus: [
        // 관리자 메뉴
        ...(userIsAdmin ? [
          {
            id: 'checklist',
            title: '체크리스트 생성',
            description: '자산 점검용 체크리스트 생성',
            icon: ClipboardCheck,
            path: '/equipment/checklist',
            color: 'blue' as const,
            roles: ['console'] as const
          },
          {
            id: 'audit-history',
            title: '자산 실사 내역 확인',
            description: '체크리스트 데이터 조회 및 관리',
            icon: FileText,
            path: '/equipment/audit-history',
            color: 'pink' as const,
            roles: ['console'] as const
          },
          {
            id: 'master-file',
            title: '마스터 파일 관리',
            description: 'SAP 자산정보 파일 갱신 및 관리',
            icon: RefreshCcw,
            path: '/equipment/master',
            color: 'purple' as const,
            roles: ['console'] as const
          }
        ] : []),
        // 사용자 메뉴
        ...(userIsUser ? [
          {
            id: 'audit',
            title: '자산 실사',
            description: 'QR코드로 빠르게 자산 실사를 수행',
            icon: ScanQrCode,
            path: '/equipment/audit',
            color: 'blue' as const,
            roles: ['user'] as const
          }
        ] : [])
      ]
    }
  ];

  const MenuCard: React.FC<{
    menu: DashboardMenuItem;
  }> = ({ menu }) => {
    const colors = colorClasses[menu.color as keyof typeof colorClasses];
    const Icon = menu.icon;

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

    return (
      <div
        onClick={() => navigate(menu.path)}
        className={`p-8 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group ${colors.shadow} transition-all relative overflow-hidden`}
      >
        <div className={`absolute top-0 right-0 w-32 h-32 ${colors.accent} rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform`}></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className={`${colors.bg} p-4 rounded-3xl ${colors.hover} transition-colors shadow-inner ${colors.text} group-hover:text-white duration-500`}>
            <Icon className="w-10 h-10" />
          </div>
          <ArrowRight className={`w-8 h-8 text-gray-200 ${arrowColorMap[menu.color]} transition-transform group-hover:translate-x-2`} />
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">{menu.title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">{menu.description}</p>
      </div>
    );
  };

  if (!userIsAdmin && !userIsUser) {
    return <LoadingOverlay message="권한 확인 중..." />;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-12 px-4 md:px-6">
      <Header headerTitle="장비 점검, 실사, QR생성 시스템" headerSubTitle="AJ솔루션테크" level={1} />

      {equipmentSections.map((section) => {
        const titleColors = colorClasses[section.titleColor];
        const gridCols = section.gridCols || '3';
        return (
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6`}>
            {section.menus
              .filter(menu => !menu.hidden)
              .map((menu) => (
                <MenuCard key={menu.id} menu={menu} />
              ))}
          </div>
        );
        // return (
        //   <div key={section.id} className="mb-12 ">
        //     <h3 className="text-[1.3rem] sm:text-2xl font-black text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
        //       <div className={`w-1 h-8 ${titleColors.titleBar} rounded-full`}></div>
        //       {section.title}
        //     </h3>
        //     <div className={`grid grid-cols-1 md:grid-cols-3 gap-6`}>
        //       {section.menus
        //         .filter(menu => !menu.hidden)
        //         .map((menu) => (
        //           <MenuCard key={menu.id} menu={menu} />
        //         ))}
        //     </div>
        //   </div>
        // );
      })}
    </div>
  );
};

export default EquipmentMainPage;

