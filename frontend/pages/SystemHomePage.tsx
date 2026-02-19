import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, isAdmin, isUser, isLoggedIn } from '../utils/orderingAuth';
import { systemHomeCards, colorClasses } from '../config/dashboardConfig';
import Button from '@/components/Button';

const SystemHomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const userIsAdmin = useMemo(() => isAdmin(currentUser), [currentUser?.role]);
  const userIsUser = useMemo(() => isUser(currentUser), [currentUser?.role]);

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  // 로그인한 경우 권한에 따라 적절한 대시보드로 리다이렉트
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { state: { from: '/' }, replace: true });
      return;
    }
    // 이미 로그인한 경우 권한에 따라 적절한 대시보드로 리다이렉트
    if (userIsAdmin) {
      navigate('/manager', { replace: true });
    } else if (userIsUser) {
      navigate('/user', { replace: true });
    }
  }, [navigate, userIsAdmin, userIsUser]);

  // 표시할 카드 필터링
  const visibleCards = systemHomeCards.filter(card => {
    if (card.hidden) return false;
    if (!card.roles || card.roles.length === 0) return true;
    return card.roles.some(role => {
      if (role === 'manager' && userIsAdmin) return true;
      if (role === 'user' && userIsUser) return true;
      return false;
    });
  });

  const handleCardClick = (card: typeof systemHomeCards[0]) => {
    let path: string;
    if (typeof card.navigateTo === 'function') {
      path = card.navigateTo(userIsAdmin, userIsUser);
    } else {
      path = card.navigateTo;
    }
    navigate(path, { state: { from: '/' } });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">홈</h1>
          <p className="mt-2 text-gray-600 font-bold">
            사용할 시스템을 선택해 주세요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            const iconColors = colorClasses[card.iconBgColor];
            const description = typeof card.description === 'function'
              ? card.description(userIsAdmin)
              : card.description;
            const isEnabled = userIsAdmin || userIsUser;

            return (
              <Button
                variant="outline"
                key={card.id}
                onClick={() => handleCardClick(card)}
                disabled={!isEnabled}
                className={`${isEnabled ? 'hover:shadow-lg hover:-translate-y-0.5' : 'opacity-50 cursor-not-allowed'
                  }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`${iconColors.titleBar} p-3 rounded-xl text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-black text-gray-900">{card.title}</h2>
                    <p className="mt-2 text-sm font-bold text-gray-600">{description}</p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SystemHomePage;


