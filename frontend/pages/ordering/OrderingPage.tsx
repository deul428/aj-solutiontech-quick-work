import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  FileText,
  Settings,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bell,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { User, Request, DashboardData } from '../../types/ordering';
import {
  getDashboardDataOrdering,
  logoutOrdering,
  ORDERING_GAS_URL
} from '../../services/orderingService';
import { getCurrentUser, getSessionToken, logout } from '../../utils/orderingAuth';
import { formatDate, getStatusColor } from '../../utils/orderingHelpers';
import LoadingOverlay from '../../components/LoadingOverlay';
import Header from '@/components/Header';

interface OrderingPageProps {
  onNavigate?: (view: string) => void;
}

const OrderingPage: React.FC<OrderingPageProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [user] = useState<User | null>(getCurrentUser());
  const [stats, setStats] = useState({ requested: 0, inProgress: 0, completed: 0, total: 0 });
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      // 사용자가 없으면 로그인 페이지로 이동
      if (onNavigate) {
        onNavigate('ordering-login');
      }
      return;
    }
    loadDashboard();
  }, [user, onNavigate]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      if (!ORDERING_GAS_URL) {
        console.warn('ORDERING_GAS_URL이 설정되지 않았습니다.');
        setStats({ requested: 0, inProgress: 0, completed: 0, total: 0 });
        setRecentRequests([]);
        setNotifications([]);
        return;
      }

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        }
        return;
      }
      const dashboardData = await getDashboardDataOrdering(ORDERING_GAS_URL, sessionToken);

      if (dashboardData && dashboardData.success !== false) {
        setStats(dashboardData.stats || { requested: 0, inProgress: 0, completed: 0, total: 0 });
        setRecentRequests(dashboardData.recentRequests || []);
        setNotifications(dashboardData.notifications || []);
      } else {
        setStats({ requested: 0, inProgress: 0, completed: 0, total: 0 });
        setRecentRequests([]);
        setNotifications([]);
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.message || '대시보드 로딩 실패');
      setStats({ requested: 0, inProgress: 0, completed: 0, total: 0 });
      setRecentRequests([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewRequest = () => {
    if (onNavigate) {
      onNavigate('ordering-new');
    }
  };

  const handleMyRequests = () => {
    if (onNavigate) {
      onNavigate('ordering-requests');
    }
  };

  const handleMyInfo = () => {
    navigate('/info');
  };

  const handleLogout = async () => {
    try {
      const sessionToken = getSessionToken();
      if (sessionToken && ORDERING_GAS_URL) {
        // 서버에 로그아웃 요청
        await logoutOrdering(ORDERING_GAS_URL, sessionToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 클라이언트에서 세션 제거
      logout();
      // 로그인 페이지로 이동
      if (onNavigate) {
        onNavigate('ordering-login');
      }
    }
  };

  if (!user) {
    return null; // 로그인 페이지로 리다이렉트 중
  }

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-12 px-4 md:px-6">
      {loading && <LoadingOverlay message="대시보드 로딩 중..." />}
      <Header headerTitle="신청 등록, 조회" headerSubTitle="부품 발주 시스템" level={2} />

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 sm:p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-gray-100 ">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-100 p-3 rounded-2xl hidden sm:block">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <h6 className="text-sm font-black text-gray-600">접수중</h6>
          </div>
          <h2 className="text-4xl font-black text-yellow-600">{stats.requested}</h2>
        </div>
        <div className="bg-white p-6 sm:p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-pink-100 p-3 rounded-2xl hidden sm:block">
              <Package className="w-6 h-6 text-pink-600" />
            </div>
            <h6 className="text-sm font-black text-gray-600">진행중</h6>
          </div>
          <h2 className="text-4xl font-black text-pink-600">{stats.inProgress}</h2>
        </div>
        <div className="bg-white p-6 sm:p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 p-3 rounded-2xl hidden sm:block">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h6 className="text-sm font-black text-gray-600">완료</h6>
          </div>
          <h2 className="text-4xl font-black text-green-600">{stats.completed}</h2>
        </div>
        <div className="bg-white p-6 sm:p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-2xl hidden sm:block">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h6 className="text-sm font-black text-gray-600">전체</h6>
          </div>
          <h2 className="text-4xl font-black text-blue-600">{stats.total}</h2>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div
          onClick={handleNewRequest}
          className="p-6 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group hover:shadow-blue-100 transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="bg-blue-100 p-4 rounded-3xl group-hover:bg-blue-600 transition-colors shadow-inner text-blue-600 group-hover:text-white">
              <Plus className="w-10 h-10" />
            </div>
            <ArrowRight className="w-8 h-8 text-gray-200 group-hover:text-blue-600 transition-transform group-hover:translate-x-2" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">새 신청 등록</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">부품 발주 신청을 등록합니다.</p>
        </div>

        <div
          onClick={handleMyRequests}
          className="p-6 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group hover:shadow-purple-100 transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="bg-purple-100 p-4 rounded-3xl group-hover:bg-purple-600 transition-colors shadow-inner text-purple-600 group-hover:text-white">
              <FileText className="w-10 h-10" />
            </div>
            <ArrowRight className="w-8 h-8 text-gray-200 group-hover:text-purple-600 transition-transform group-hover:translate-x-2" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">내 신청 목록</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">내가 신청한 부품 발주 내역을 확인합니다.</p>
        </div>

        <div
          onClick={handleMyInfo}
          className="p-6 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group hover:shadow-gray-100 transition-all relative overflow-hidden hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="bg-gray-100 p-4 rounded-3xl group-hover:bg-gray-600 transition-colors shadow-inner text-gray-600 group-hover:text-white">
              <Settings className="w-10 h-10" />
            </div>
            <ArrowRight className="w-8 h-8 text-gray-200 group-hover:text-gray-600 transition-transform group-hover:translate-x-2" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">내 정보</h3>
          <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">내 정보를 확인하고 비밀번호를 변경합니다.</p>
        </div>
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6">
          <p className="text-red-700 font-bold text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default OrderingPage;

