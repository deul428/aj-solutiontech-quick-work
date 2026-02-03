import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { isAdmin, getCurrentUser, getSessionToken } from '../utils/orderingAuth';
import { getAllUsers, createUser, updateUser, deleteUser } from '../services/adminService';
import { User } from '../types/ordering';
import LoadingOverlay from '../components/LoadingOverlay';
import Toast from '../components/Toast';
import DataTable, { TableColumn } from '../components/DataTable';

const AdminUserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | '관리자' | '신청자'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'employeeCode' | 'regionTeam' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
    name: '',
    employeeCode: '',
    team: '',
    region: '',
    role: '신청자' as '신청자' | '관리자',
    active: 'Y'
  });
  const [processing, setProcessing] = useState(false);

  // user의 role을 메모이제이션하여 안정적인 참조 생성
  const isUserAdmin = useMemo(() => user && isAdmin(user), [user?.role]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate('/login');
        return;
      }
      const data = await getAllUsers(sessionToken);
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.message || '사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // 사용 가능한 지역 목록 추출
  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    users.forEach(u => {
      if (u.region) {
        regions.add(u.region);
      }
    });
    return Array.from(regions).sort();
  }, [users]);

  // 선택한 지역에 속한 팀 목록 추출
  const availableTeams = useMemo(() => {
    if (regionFilter === 'all') {
      return [];
    }
    const teams = new Set<string>();
    users.forEach(u => {
      if (u.region === regionFilter && u.team) {
        teams.add(u.team);
      }
    });
    return Array.from(teams).sort();
  }, [users, regionFilter]);

  // 지역 필터 변경 시 팀 필터 초기화
  useEffect(() => {
    if (regionFilter === 'all') {
      setTeamFilter('all');
    } else if (!availableTeams.includes(teamFilter) && teamFilter !== 'all') {
      setTeamFilter('all');
    }
  }, [regionFilter, availableTeams, teamFilter]);

  // 필터나 검색어 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, regionFilter, teamFilter]);

  const filterUsers = useCallback(() => {
    let filtered = [...users];

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        String(u.userId || '').toLowerCase().includes(term) ||
        String(u.name || '').toLowerCase().includes(term) ||
        String(u.team || '').toLowerCase().includes(term)
      );
    }

    // 역할 필터
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // 지역 필터
    if (regionFilter !== 'all') {
      filtered = filtered.filter(u => u.region === regionFilter);
    }

    // 팀 필터 (지역이 선택된 경우에만 적용)
    if (regionFilter !== 'all' && teamFilter !== 'all') {
      filtered = filtered.filter(u => u.team === teamFilter);
    }

    // 정렬
    if (sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;

        if (sortBy === 'name') {
          const nameA = String(a.name || '').toLowerCase();
          const nameB = String(b.name || '').toLowerCase();
          comparison = nameA.localeCompare(nameB, 'ko');
        } else if (sortBy === 'employeeCode') {
          const codeA = String(a.employeeCode || '').toLowerCase();
          const codeB = String(b.employeeCode || '').toLowerCase();
          comparison = codeA.localeCompare(codeB, 'ko');
        } else if (sortBy === 'regionTeam') {
          // 지역 먼저 정렬, 그 다음 팀
          const regionA = String(a.region || '').toLowerCase();
          const regionB = String(b.region || '').toLowerCase();
          const regionComparison = regionA.localeCompare(regionB, 'ko');
          if (regionComparison !== 0) {
            comparison = regionComparison;
          } else {
            const teamA = String(a.team || '').toLowerCase();
            const teamB = String(b.team || '').toLowerCase();
            comparison = teamA.localeCompare(teamB, 'ko');
          }
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, regionFilter, teamFilter, sortBy, sortOrder]);

  // 페이징 처리된 사용자 목록
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, currentPage, pageSize]);

  // 총 페이지 수 계산
  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / pageSize);
  }, [filteredUsers.length, pageSize]);

  useEffect(() => {
    // 권한 체크 (ProtectedAdminRoute에서 이미 체크하지만 이중 체크)
    if (!isUserAdmin) {
      alert('접근 권한이 없습니다.');
      navigate('/user', { replace: true });
      return;
    }
    loadUsers();
  }, [isUserAdmin, loadUsers, navigate]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      userId: '',
      password: '',
      name: '',
      employeeCode: '',
      team: '',
      region: '',
      role: '신청자',
      active: 'Y'
    });
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      userId: user.userId,
      password: '',
      name: user.name || '',
      employeeCode: user.employeeCode || '',
      team: user.team || '',
      region: user.region || '',
      role: user.role || '신청자',
      active: user.active || 'Y'
    });
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(`정말로 사용자 "${userId}"를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate('/login');
        return;
      }
      const result = await deleteUser(userId, sessionToken);
      if (result.success) {
        await loadUsers();
      } else {
        setError(result.message || '사용자 삭제에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '사용자 삭제 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSort = (key: string) => {
    const column = key as 'name' | 'employeeCode' | 'regionTeam';
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // 테이블 컬럼 설정 - 여기서 쉽게 헤더 관리 가능
  const columns: TableColumn<User>[] = useMemo(() => [
    {
      key: 'userId',
      label: '사용자ID',
      sortable: false
    },
    {
      key: 'name',
      label: '이름',
      sortable: true,
      sortKey: 'name'
    },
    {
      key: 'employeeCode',
      label: '기사코드',
      sortable: true,
      sortKey: 'employeeCode'
    },
    {
      key: 'regionTeam',
      label: '소속 지역 / 팀',
      sortable: true,
      sortKey: 'regionTeam',
      render: (_, row) => `${row.region || ''} - ${row.team || ''}`
    },
    {
      key: 'role',
      label: '역할',
      sortable: false
    },
    {
      key: 'active',
      label: '활성화',
      sortable: false,
      render: (value) => value === 'Y' ? '활성' : '비활성'
    },
    {
      key: 'actions',
      label: '작업',
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-900"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.userId)}
            disabled={processing}
            className="text-red-600 hover:text-red-900 disabled:text-gray-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], [processing]);

  const handleSave = async () => {
    try {
      setProcessing(true);
      setError('');
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate('/login');
        return;
      }

      if (!formData.userId || !formData.name) {
        setError('사용자ID와 이름은 필수입니다.');
        return;
      }

      let result;
      if (editingUser) {
        // 수정
        result = await updateUser(editingUser.userId, {
          name: formData.name,
          employeeCode: formData.employeeCode,
          team: formData.team,
          region: formData.region,
          role: formData.role,
          active: formData.active,
          password: formData.password || undefined
        }, sessionToken);
      } else {
        // 등록
        if (!formData.password) {
          setError('신규 사용자는 비밀번호가 필요합니다.');
          return;
        }
        result = await createUser({
          userId: formData.userId,
          password: formData.password,
          name: formData.name,
          employeeCode: formData.employeeCode,
          team: formData.team,
          region: formData.region,
          role: formData.role,
          active: formData.active
        }, sessionToken);
      }

      if (result.success) {
        setShowModal(false);
        setEditingUser(null);
        await loadUsers();
        // 데이터 동기화 완료 후 toast 메시지 표시
        setToast({ message: result.message || '저장되었습니다.', type: 'success' });
      } else {
        setError(result.message || '저장에 실패했습니다.');
        setToast({ message: result.message || '저장에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="데이터를 불러오는 중..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">사용자 관리</h1>
            <p className="mt-2 text-gray-600">
              총 {filteredUsers.length}명의 사용자가 등록되어 있습니다.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            사용자 등록
          </button>
        </div>

        {/* 검색 및 필터 */}
        <div className="mb-6 space-y-4">
          {/* 검색 입력 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="사용자ID, 이름, 소속팀으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap gap-4">
            {/* 역할 필터 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">역할:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | '관리자' | '신청자')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white w-[150px]"
              >
                <option value="all">전체</option>
                <option value="관리자">관리자</option>
                <option value="신청자">신청자</option>
              </select>
            </div>

            {/* 지역 필터 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">지역:</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[150px]"
              >
                <option value="all">전체</option>
                {availableRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            {/* 팀 필터 (지역이 선택된 경우에만 표시) */}
            {regionFilter !== 'all' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">팀:</label>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
                >
                  <option value="all">전체</option>
                  {availableTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 테이블 */}
        <DataTable
          data={filteredUsers}
          columns={columns}
          sortBy={sortBy || undefined}
          sortOrder={sortOrder}
          onSort={handleSort}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 15, 30, 50]}
          keyExtractor={(row) => row.userId}
          emptyMessage="등록된 사용자가 없습니다."
        />

        {/* 등록/수정 모달 */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingUser ? '사용자 수정' : '사용자 등록'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사용자ID {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    disabled={!!editingUser}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호 {!editingUser && <span className="text-red-500">*</span>}
                    {editingUser && <span className="text-gray-500 text-xs">(변경 시에만 입력)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기사코드
                    </label>
                    <input
                      type="text"
                      value={formData.employeeCode}
                      onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      소속팀
                    </label>
                    <input
                      type="text"
                      value={formData.team}
                      onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지역
                    </label>
                    <input
                      type="text"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      역할
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as '신청자' | '관리자' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="신청자">신청자</option>
                      <option value="관리자">관리자</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    활성화
                  </label>
                  <select
                    value={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Y">활성</option>
                    <option value="N">비활성</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {processing ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
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

export default AdminUserManagementPage;

