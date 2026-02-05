import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import "./App.css";
import { MasterDataRow } from "./types";
import CountMasterPage from "./pages/count/CountMasterPage";
import SystemHomePage from "./pages/SystemHomePage";
import CountChecklistPage from "./pages/count/CountChecklistPage";
import CountAuditPage from "./pages/count/CountAuditPage";
import OrderingPage from "./pages/ordering/OrderingPage";
import OrderingNewRequestPage from "./pages/ordering/OrderingNewRequestPage";
import OrderingMyRequestsPage from "./pages/ordering/OrderingMyRequestsPage";
import OrderingRequestDetailPage from "./pages/ordering/OrderingRequestDetailPage";
import OrderingMyInfoPage from "./pages/ordering/OrderingMyInfoPage";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import CountAdminAuditHistoryPage from "./pages/count/CountAdminAuditHistoryPage";
import OrderingAdminRequestsPage from "./pages/ordering/OrderingAdminRequestsPage";
import AdminUserManagementPage from "./pages/AdminUserManagementPage";
import AdminDeliveryPlaceManagementPage from "./pages/AdminDeliveryPlaceManagementPage";
import LoadingOverlay from "./components/LoadingOverlay";
import Navbar from "./components/Navbar";
import { fetchMasterFromCloud, fetchSheetList, AUDIT_GAS_URL } from "./services/excelService";
import { isLoggedIn, getCurrentUser, isAdmin, isUser, logout } from "./utils/orderingAuth";

type ViewType = "home" | "checklist" | "audit";

// 관리자 라우트 보호 컴포넌트
interface ProtectedAdminRouteProps {
  children: React.ReactElement;
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isUserLoggedIn = isLoggedIn();
  const userIsAdmin = isAdmin(currentUser);
  const userIsUser = isUser(currentUser);

  useEffect(() => {
    // 로그인하지 않은 경우
    if (!isUserLoggedIn) {
      alert('로그인이 필요합니다.');
      navigate('/login', { state: { from: window.location.pathname }, replace: true });
      return;
    }

    // 로그인했지만 관리자가 아닌 경우
    if (!userIsAdmin) {
      alert('접근 권한이 없습니다.');
      navigate('/user', { replace: true });
      return;
    }
  }, [isUserLoggedIn, userIsAdmin, navigate]);

  // 로그인하지 않았거나 관리자가 아닌 경우 로딩 표시
  if (!isUserLoggedIn || !userIsAdmin) {
    return <LoadingOverlay message="권한 확인 중..." />;
  }

  return children;
};

// Ordering Router Component
const OrderingRoutes: React.FC = () => {
  const navigate = useNavigate();

  const handleOrderingNavigate = (view: string, reqNo?: string) => {
    if (view.startsWith('ordering') && view !== 'ordering-login') {
      if (!isLoggedIn()) {
        navigate('/ordering/login');
        return;
      }
    }

    switch (view) {
      case 'ordering':
        navigate('/ordering');
        break;
      case 'ordering-new':
        navigate('/ordering/new');
        break;
      case 'ordering-requests':
        navigate('/ordering/requests');
        break;
      case 'ordering-detail':
        if (reqNo) {
          navigate(`/ordering/detail/${reqNo}`);
        }
        break;
      case 'ordering-info':
        navigate('/info');
        break;
      case 'ordering-login':
        navigate('/login', { state: { from: '/ordering' } });
        break;
      default:
        navigate('/');
    }
  };

  return (
    <Routes>
      <Route index element={<OrderingPage onNavigate={handleOrderingNavigate} />} />
      <Route path="new" element={<OrderingNewRequestPage onNavigate={handleOrderingNavigate} />} />
      <Route path="requests" element={<OrderingMyRequestsPage onNavigate={handleOrderingNavigate} />} />
      <Route path="detail/:requestNo" element={<OrderingRequestDetailPage onNavigate={handleOrderingNavigate} />} />
      {/* /info 라우트는 MainApp 레벨로 이동 */}
      {/* /ordering/login은 /login으로 리다이렉트 (handleOrderingNavigate에서 처리) */}
      <Route path="*" element={<div>404 - Page not found</div>} />
    </Routes>
  );
};


// Main App Component (non-ordering pages)
const MainApp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [masterData, setMasterData] = useState<MasterDataRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [serviceUrl, setServiceUrl] = useState<string>(AUDIT_GAS_URL);

  // Multiple Sheet Management
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [currentUser, setCurrentUserState] = useState(getCurrentUser());

  // 사용자 정보 업데이트 감지
  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentUserState(getCurrentUser());
    };
    window.addEventListener('storage', handleStorageChange);
    // 컴포넌트 마운트 시 사용자 정보 확인
    setCurrentUserState(getCurrentUser());
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const userIsAdmin = isAdmin(currentUser);
  const userIsUser = isUser(currentUser);
  const isUserLoggedIn = isLoggedIn();

  const loadData = async (customUrl?: string, targetSheet?: string) => {
    const urlToUse = customUrl || serviceUrl;
    setIsInitialLoading(true);

    try {
      // 1. Fetch sheet list if not already loaded or if URL changed
      let sheets = availableSheets;
      if (customUrl || availableSheets.length === 0) {
        sheets = await fetchSheetList(urlToUse);
        setAvailableSheets(sheets);
      }

      // 2. Decide which sheet to load
      const sheetName = targetSheet || (sheets.length > 0 ? sheets[0] : undefined);

      // 3. Fetch data
      const data = await fetchMasterFromCloud(urlToUse, sheetName);
      setMasterData(data);
      setSelectedSheet(sheetName || "기본 시트");
      setFileName(`구글 클라우드 (${sheetName || "기본"})`);
      setLastSyncTime(new Date().toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }));

      if (customUrl) setServiceUrl(customUrl);
    } catch (err) {
      console.error(err);
      if (!customUrl) setMasterData([]);
      throw err;
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    // to-be: 홈 진입만으로 마스터파일을 자동 동기화하지 않음.
    // 마스터 참조가 필요한 화면(체크리스트/실사/장비홈)에서만 필요 시 로드.
    if (!isUserLoggedIn) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
    }
    const needsMaster =
      location.pathname === "/checklist" ||
      location.pathname === "/audit" ||
      location.pathname === "/equipment";

    // 로그인되어 있을 때만 동기화 수행
    if (needsMaster && masterData.length === 0 && !isInitialLoading && isUserLoggedIn) {
      loadData().catch(() => { });
    }
    // masterData/isInitialLoading은 의도적으로 deps에서 제외(무한루프 방지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isUserLoggedIn]);

  const handleSheetSwitch = (sheetName: string) => {
    loadData(serviceUrl, sheetName).catch(() => alert("시트 데이터를 불러오지 못했습니다."));
  };

  const handleLogout = () => {
    logout();
    setCurrentUserState(null);
  };

  const renderView = () => {
    return (
      <Routes>
        {/* 홈: 시스템 선택 (마스터 자동 동기화 X) */}
        <Route path="/" element={<SystemHomePage />} />

        {/* 장비 점검/실사/QR 시스템 홈(기존 CountMasterPage) */}
        <Route
          path="/equipment"
          element={
            <CountMasterPage
              masterData={masterData}
              setMasterData={setMasterData}
              fileName={fileName}
              setFileName={setFileName}
              onNavigate={(view) => {
                setCurrentView(view as ViewType);
              }}
              onRefresh={loadData}
              lastSyncTime={lastSyncTime}
              serviceUrl={serviceUrl}
              availableSheets={availableSheets}
              selectedSheet={selectedSheet}
              onSheetSwitch={handleSheetSwitch}
            />
          }
        />

        {/* 장비 점검/실사/QR 시스템: 역할별 enable */}
        <Route
          path="/checklist"
          element={
            userIsAdmin ? (
              <CountChecklistPage masterData={masterData} serviceUrl={serviceUrl} selectedSheet={selectedSheet || undefined} />
            ) : (
              <div className="p-6 text-center text-gray-600 font-bold">접근 권한이 없습니다.</div>
            )
          }
        />
        <Route
          path="/audit"
          element={
            (userIsUser || userIsAdmin) ? (
              <CountAuditPage masterData={masterData} setMasterData={setMasterData} serviceUrl={serviceUrl} selectedSheet={selectedSheet || undefined} isDataLoading={isInitialLoading} />
            ) : (
              <div className="p-6 text-center text-gray-600 font-bold">접근 권한이 없습니다.</div>
            )
          }
        />
        {/* Ordering Routes를 MainApp 내부로 통합하여 네비게이션 바 유지 */}
        <Route path="/ordering/*" element={<OrderingRoutes />} />

        {/* 내 정보 변경 - 상위 레벨로 이동 (로그인한 모든 사용자) */}
        {isUserLoggedIn && (
          <Route path="/info" element={<OrderingMyInfoPage />} />
        )}

        {/* 관리자 라우트 - 보호된 라우트 */}
        <Route path="/console" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
        <Route path="/console/audit-history" element={<ProtectedAdminRoute><CountAdminAuditHistoryPage /></ProtectedAdminRoute>} />
        <Route path="/console/requests" element={<ProtectedAdminRoute><OrderingAdminRequestsPage /></ProtectedAdminRoute>} />
        <Route path="/console/users" element={<ProtectedAdminRoute><AdminUserManagementPage /></ProtectedAdminRoute>} />
        <Route path="/console/delivery-places" element={<ProtectedAdminRoute><AdminDeliveryPlaceManagementPage /></ProtectedAdminRoute>} />

        {/* 사용자 라우트 - 관리자도 접근 가능 */}
        {(isUser(getCurrentUser()) || isAdmin(getCurrentUser())) && (
          <Route path="/user" element={<UserDashboardPage />} />
        )}
      </Routes>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {isInitialLoading && <LoadingOverlay message="클라우드 마스터 데이터를 불러오는 중..." />}

      {/* Navigation Bar */}
      <Navbar onLogout={handleLogout} />

      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-xs">
          &copy; 2026. AJ Networks Corporation. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

// Root App Component
const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 전역 에러 핸들러: 404나 인증 에러 발생 시 처리
  useEffect(() => {
    // fetch 에러 감지 및 처리
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        // 404나 인증 에러 처리
        if ((response.status === 404 || response.status === 401 || response.status === 403) && location.pathname !== '/login') {
          // 응답 본문 확인 (404 not_found 메시지 체크)
          try {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            if (text.includes('not_found') || text.includes('404')) {
              // 인증 상태 확인 후 로그인으로 리다이렉트
              if (!isLoggedIn()) {
                navigate('/login', { state: { from: location.pathname }, replace: true });
                return response;
              }
            }
          } catch (e) {
            // 응답 본문 읽기 실패는 무시
          }

          // 인증 에러인 경우 로그인으로 리다이렉트
          if ((response.status === 401 || response.status === 403) && !isLoggedIn()) {
            navigate('/login', { state: { from: location.pathname }, replace: true });
          }
        }

        return response;
      } catch (error: any) {
        // 네트워크 에러나 기타 에러 처리
        if (error?.message?.includes('404') || error?.message?.includes('not_found')) {
          if (location.pathname !== '/login' && !isLoggedIn()) {
            navigate('/login', { state: { from: location.pathname }, replace: true });
          }
        }
        throw error;
      }
    };

    // 전역 에러 이벤트 리스너
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || event.error?.message || '';

      // 404 에러나 인증 관련 에러 감지
      if ((errorMessage.includes('404') || errorMessage.includes('not_found') || errorMessage.includes('401') || errorMessage.includes('403')) && location.pathname !== '/login') {
        if (!isLoggedIn()) {
          navigate('/login', { state: { from: location.pathname }, replace: true });
        }
      }
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.fetch = originalFetch;
    };
  }, [navigate, location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
};

export default App;
