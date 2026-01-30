import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isUser, getCurrentUser } from '../utils/orderingAuth';
import LoadingOverlay from '../components/LoadingOverlay';
import { userDashboardSections } from '../config/dashboardConfig';
import DashboardPage from '../components/DashboardPage';

const UserDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [isLoading, setIsLoading] = React.useState(true);

  // user의 role을 메모이제이션하여 안정적인 참조 생성
  const isUserRole = useMemo(() => user && isUser(user), [user?.role]);

  useEffect(() => {
    // 권한 체크
    if (!isUserRole) {
      navigate('/');
      return;
    }
    setIsLoading(false);
  }, [isUserRole, navigate]);

  if (isLoading) {
    return <LoadingOverlay message="로딩 중..." />;
  }

  return (
    <DashboardPage
      sections={userDashboardSections}
      headerTitle="사용자 대시보드"
      userRole="user"
      userName={user?.name}
      userTeam={user?.team}
    />
  );
};

export default UserDashboardPage;

