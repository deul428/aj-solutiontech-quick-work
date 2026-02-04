import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, User as UserIcon } from 'lucide-react';
import { changePasswordOrdering, ORDERING_GAS_URL } from '../../services/orderingService';
import { getCurrentUser, getSessionToken } from '../../utils/orderingAuth';
import LoadingOverlay from '../../components/LoadingOverlay';
import Toast from '../../components/Toast';
import Header from '@/components/Header';

const OrderingMyInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  if (!user) {
    navigate('/login', { state: { from: '/info' } });
    return null;
  }

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!passwordData.currentPassword) {
      setError('현재 비밀번호를 입력해 주세요.');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('새 비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);

    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate('/login', { state: { from: '/info' } });
        return;
      }

      if (!ORDERING_GAS_URL) {
        throw new Error('GAS URL이 설정되지 않았습니다.');
      }

      const result = await changePasswordOrdering(
        ORDERING_GAS_URL,
        passwordData.currentPassword,
        passwordData.newPassword,
        sessionToken
      );

      if (result.success) {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setToast({ message: result.message || '비밀번호가 변경되었습니다.', type: 'success' });
      } else {
        setError(result.message || '비밀번호 변경에 실패했습니다.');
        setToast({ message: result.message || '비밀번호 변경에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setError(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    // 이전 페이지로 돌아가거나 홈으로 이동
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      {submitting && <LoadingOverlay message="비밀번호 변경 중..." />}

      {/* 헤더 */}
      <Header headerTitle="기본 정보 조회" headerSubTitle="내 정보 관리" level={2} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 font-bold text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-700 font-bold text-sm">{success}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-blue-600" />
            기본 정보
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">사용자 ID</label>
              <p className="text-lg font-bold text-gray-800">{user.userId}</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">이름</label>
              <p className="text-lg font-bold text-gray-800">{user.name}</p>
            </div>
            {user.employeeCode && (
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2">기사코드</label>
                <p className="text-lg font-bold text-gray-800">{user.employeeCode}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">소속팀</label>
              <p className="text-lg font-bold text-gray-800">{user.team}</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">지역</label>
              <p className="text-lg font-bold text-gray-800">{user.region}</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">권한</label>
              <p className="text-lg font-bold text-gray-800">{user.role && user.role.includes("신청자") ? "일반 사용자" : user.role}</p>
            </div>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
            <Key className="w-6 h-6 text-blue-600" />
            비밀번호 변경
          </h3>
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">현재 비밀번호</label>
              <input
                type="password" 
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">새 비밀번호</label>
                <input
                  type="password" 
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  minLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-2 font-bold">최소 6자 이상 입력해 주세요.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">새 비밀번호 확인</label>
                <input
                  type="password" 
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black disabled:bg-gray-400 transition-colors w-full sm:w-auto"
              >
                {submitting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast 메시지 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default OrderingMyInfoPage;

