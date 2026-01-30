import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdmin, getCurrentUser } from '../utils/orderingAuth';
import LoadingOverlay from '../components/LoadingOverlay';
import { adminDashboardSections } from '../config/dashboardConfig';
import DashboardPage from '../components/DashboardPage';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [isLoading, setIsLoading] = React.useState(true);

  // user의 role을 메모이제이션하여 안정적인 참조 생성
  const isUserAdmin = useMemo(() => user && isAdmin(user), [user?.role]);

  useEffect(() => {
    // 권한 체크
    if (!isUserAdmin) {
      navigate('/');
      return;
    }
    setIsLoading(false);
  }, [isUserAdmin, navigate]);

  if (isLoading) {
    return <LoadingOverlay message="로딩 중..." />;
  }

  return (
    <DashboardPage
      sections={adminDashboardSections}
      headerTitle="관리자 대시보드"
      userRole="admin"
      userName={user?.name}
      userTeam={user?.team}
    />
  );
};

export default AdminDashboardPage;
