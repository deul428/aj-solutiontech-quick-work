import React, { useState, useEffect } from 'react';
import { LogIn, AlertCircle, Key } from 'lucide-react';
import { loginOrdering, ORDERING_GAS_URL } from '../services/orderingService';
import { setCurrentUser, isAdmin, isUser } from '../utils/orderingAuth';
import LoadingOverlay from '../components/LoadingOverlay';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/icons/android-icon-512x512.png';
import Button from '@/components/Button';

const LoginPage: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 로그인 성공 후 리다이렉트할 경로 (이전 페이지 또는 홈)
  const getRedirectPath = () => {
    const state = location.state as { from?: string } | null;
    if (state?.from) {
      return state.from;
    }
    return '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setLoading(true);

    try {
      if (!ORDERING_GAS_URL) {
        throw new Error('GAS URL이 설정되지 않았습니다.');
      }

      const result = await loginOrdering(ORDERING_GAS_URL, userId.trim(), password);

      if (result.success && result.sessionToken && result.user) {
        // 사용자 정보와 세션 토큰 저장
        setCurrentUser(result.user, result.sessionToken);

        // 권한에 따라 리다이렉트 경로 결정
        let redirectPath = getRedirectPath();
        if (isAdmin(result.user)) {
          // 관리자는 /console이 홈 역할
          redirectPath = '/console';
        } else if (isUser(result.user)) {
          // 사용자는 /user가 홈 역할
          redirectPath = '/user';
        }
        navigate(redirectPath, { replace: true });
      } else {
        alert(result.message || '로그인에 실패했습니다.');
      }
    } catch (err: any) {
      alert(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      {loading && <LoadingOverlay message="로그인 중..." />}

      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 ">
            <img src={logo} alt="logo" className="w-full w-full" />
            {/* <Key className="w-8 h-8 text-white" /> */}
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">시스템 로그인</h1>
        </div>

        {/* 에러 메시지 */}
        {/* {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700 font-bold text-sm">{error}</p>
            </div>
          </div>
        )} */}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              사용자 ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold"
              placeholder="사용자 ID를 입력하세요"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <Button
            variant="primary"
            type="submit"
            disabled={loading} 
            fullWidth
          >
            <LogIn className="w-4 h-4" />
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        {/* 푸터 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>&copy; 2026. AJ Networks Corporation. All rights reserved.</p>
        </div>
      </div>
    </div >
  );
};

export default LoginPage;

