import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Cog,
  FileText,
  CheckCircle2,
  Clock,
  Bell,
  ArrowRight,
  LucideIcon
} from 'lucide-react';
import { User, Request } from '../../types/ordering';
import {
  getDashboardDataOrdering,
  logoutOrdering,
  ORDERING_GAS_URL
} from '../../services/orderingService';
import { getCurrentUser, getSessionToken, logout, isOrderingAdmin } from '../../utils/orderingAuth';
import LoadingOverlay from '../../components/LoadingOverlay';
import Header from '@/components/Header';

interface OrderingPageProps {
  onNavigate?: (view: string) => void;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: 'yellow' | 'pink' | 'green' | 'blue';
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color: 'blue' | 'purple' | 'red';
  onClick: () => void;
}

const EMPTY_STATS = { requested: 0, inProgress: 0, completed: 0, total: 0 };

const OrderingPage: React.FC<OrderingPageProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [user] = useState<User | null>(getCurrentUser());
  const [stats, setStats] = useState(EMPTY_STATS);
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [notifications, setNotifications] = useState<Array<{ message: string }>>([]);
  const [loading, setLoading] = useState(true); 
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const isUserAdmin = useMemo(() => isOrderingAdmin(getCurrentUser()), []);

  useEffect(() => {
    if (!user) {
      onNavigate?.('login');
      return;
    }
    loadDashboard();
  }, [user, onNavigate]);

  const resetDashboard = useCallback(() => {
    setStats(EMPTY_STATS);
    setRecentRequests([]);
    setNotifications([]);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setToast(null);

      if (!ORDERING_GAS_URL) {
        console.warn('ORDERING_GAS_URL이 설정되지 않았습니다.');
        resetDashboard();
        return;
      }

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        onNavigate?.('login');
        return;
      }

      const dashboardData = await getDashboardDataOrdering(ORDERING_GAS_URL, sessionToken);

      if (dashboardData.success !== false) {
        setStats(dashboardData.stats || EMPTY_STATS);
        setRecentRequests(dashboardData.recentRequests || []);
        setNotifications(dashboardData.notifications || []);
      } else {
        resetDashboard();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '대시보드 로딩 실패';
      console.error('Dashboard load error:', err);
      
      // Unauthorized 에러인 경우 로그인 페이지로 리다이렉트
      if (err instanceof Error && errorMessage.includes('Unauthorized')) {
        alert('인증이 만료되었습니다. 다시 로그인해주세요.');
        resetDashboard();
        setTimeout(() => onNavigate?.('login'), 1500);
        return;
      }
      
      setToast({ message: errorMessage, type: 'error' });
      resetDashboard();
    } finally {
      setLoading(false);
    }
  }, [onNavigate, resetDashboard]);

  const handleNavigation = useCallback((view: string) => {
    onNavigate?.(view);
  }, [onNavigate]);

  const handleLogout = useCallback(async () => {
    try {
      const sessionToken = getSessionToken();
      if (sessionToken && ORDERING_GAS_URL) {
        await logoutOrdering(ORDERING_GAS_URL, sessionToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
      setToast({ message: error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      logout();
      onNavigate?.('login');
    }
  }, [onNavigate]);

  const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color }) => {
    const colorClasses = {
      yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
      pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-600' }
    };

    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className={`${colorClasses[color].bg} p-3 rounded-2xl hidden sm:block`}>
            <Icon className={`w-6 h-6 ${colorClasses[color].text}`} />
          </div>
          <h6 className="text-sm font-black text-gray-600">{label}</h6>
        </div>
        <h2 className={`text-4xl font-black ${colorClasses[color].text}`}>{value}</h2>
      </div>
    );
  };

  const ActionCard: React.FC<ActionCardProps> = ({ title, description, icon: Icon, color, onClick }) => {
    const colorConfig = {
      blue: {
        bg: 'bg-blue-50',
        iconBg: 'bg-blue-100',
        iconHover: 'group-hover:bg-blue-600',
        iconText: 'text-blue-600',
        hover: 'hover:shadow-blue-100',
        arrow: 'group-hover:text-blue-600'
      },
      purple: {
        bg: 'bg-purple-50',
        iconBg: 'bg-purple-100',
        iconHover: 'group-hover:bg-purple-600',
        iconText: 'text-purple-600',
        hover: 'hover:shadow-purple-100',
        arrow: 'group-hover:text-purple-600'
      },
      red: {
        bg: 'bg-red-50',
        iconBg: 'bg-red-100',
        iconHover: 'group-hover:bg-red-600',
        iconText: 'text-red-600',
        hover: 'hover:shadow-red-100',
        arrow: 'group-hover:text-red-600'
      }
    };

    const config = colorConfig[color];

    return (
      <div
        onClick={onClick}
        className={`p-6 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group ${config.hover} transition-all relative overflow-hidden`}
      >
        <div className={`absolute top-0 right-0 w-32 h-32 ${config.bg} rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform`}></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className={`${config.iconBg} p-4 rounded-3xl ${config.iconHover} transition-colors shadow-inner ${config.iconText} group-hover:text-white`}>
            <Icon className="w-10 h-10" />
          </div>
          <ArrowRight className={`w-8 h-8 text-gray-200 ${config.arrow} transition-transform group-hover:translate-x-2`} />
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">{description}</p>
      </div>
    );
  };

  if (!user) {
    return null;
  }

  const headerTitle = isUserAdmin ? "신청 등록, 조회, 관리" : "신청 등록, 조회";

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-12 px-4 md:px-6">
      {loading && <LoadingOverlay message="대시보드 로딩 중..." />}
      <Header headerTitle={headerTitle} headerSubTitle="부품 발주" level={2} />

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <StatCard label="접수중" value={stats.requested} icon={Clock} color="yellow" />
        <StatCard label="진행중" value={stats.inProgress} icon={Package} color="pink" />
        <StatCard label="완료" value={stats.completed} icon={CheckCircle2} color="green" />
        <StatCard label="전체" value={stats.total} icon={FileText} color="blue" />
      </div>

      {/* 빠른 액션 */}
      <div className={`grid grid-cols-1 md:grid-cols-${isUserAdmin ? '3' : '2'} gap-6 mb-8`}>
        <ActionCard
          title="새 신청 등록"
          description="부품 발주 신청을 등록합니다."
          icon={Plus}
          color="blue"
          onClick={() => handleNavigation('ordering-new')}
        />
        <ActionCard
          title="내 신청 목록"
          description="내가 신청한 부품 발주 내역을 확인합니다."
          icon={Cog}
          color="purple"
          onClick={() => handleNavigation('ordering-myrequest')}
        />
        {isUserAdmin && (
          <ActionCard
            title="부품 신청 현황 조회 (관리자)"
            description="정비사들이 신청한 전체 부품 발주 내역을 확인합니다."
            icon={FileText}
            color="red"
            onClick={() => handleNavigation('ordering-requests')}
          />
        )}
      </div>

      {/* 중요 알림 */}
      {notifications.length > 0 && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-6">
            <Bell className="w-6 h-6 text-blue-600" /> 중요 알림
          </h3>
          <div className="space-y-3">
            {notifications.map((notif, idx) => (
              <div key={idx} className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-xl">
                <p className="text-sm font-bold text-gray-700">{notif.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
 
    </div>
  );
};

export default OrderingPage;

