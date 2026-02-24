import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardPage from "../components/DashboardPage";
import LoadingOverlay from "../components/LoadingOverlay";
import { unifiedDashboardSections } from "../config/dashboardConfig";
import { getCurrentUser, getUiRole, isLoggedIn } from "../utils/orderingAuth";

const DashboardUnifiedPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  const user = getCurrentUser();
  const uiRole = getUiRole(user);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login", { state: { from: location.pathname }, replace: true });
      return;
    }
    setLoading(false);
  }, [navigate, location.pathname]);

  if (loading) {
    return <LoadingOverlay message="로딩 중..." />;
  }

  return (
    <DashboardPage
      sections={unifiedDashboardSections}
      headerTitle="대시보드"
      userRole={uiRole}
      userName={user?.name}
      userTeam={user?.team}
    />
  );
};

export default DashboardUnifiedPage;

