import React from 'react';
import { isAdmin, getCurrentUser } from '../utils/orderingAuth';
import { adminDashboardSections } from '../config/dashboardConfig';
import DashboardPage from '../components/DashboardPage';

const AdminDashboardPage: React.FC = () => {
  const user = getCurrentUser();
  // 보호된 라우트(ProtectedAdminRoute)에서 이미 로그인/권한 체크를 수행함.
  // 여기서는 UI 렌더링만 담당.
  // (방어적으로 user가 없으면 빈 화면 대신 접근 불가를 표시)
  if (!user || !isAdmin(user)) {
    return <div className="p-6 text-center text-gray-600 font-bold">접근 권한이 없습니다.</div>;
  }

  return (
    <DashboardPage
      sections={adminDashboardSections}
      headerTitle="관리자 대시보드"
      userRole="manager"
      userName={user?.name}
      userTeam={user?.team}
    />
  );
};

export default AdminDashboardPage;
