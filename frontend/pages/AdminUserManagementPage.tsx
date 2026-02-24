import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Search, RefreshCw, Users, ReceiptTurkishLiraIcon } from "lucide-react";
import {
  isOrderingAdmin,
  getCurrentUser,
  getSessionToken,
} from "../utils/orderingAuth";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  bulkUpdatePasswordsFromTargetColumn,
  getRegionTeams,
} from "../services/adminService";
import { User, RegionTeam } from "../types/ordering";
import LoadingOverlay from "../components/LoadingOverlay";
import Toast from "../components/Toast";
import DataTable, { TableColumn } from "../components/DataTable";
import Header from "@/components/Header";
import TeamManagementModal from "../components/TeamManagementModal";
import Button from "../components/Button";

const AdminUserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "관리자" | "신청자">(
    "all",
  );
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "name" | "employeeCode" | "regionTeam" | null
  >(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    password: "",
    name: "",
    employeeCode: "",
    team: "",
    region: "",
    // 시스템별 권한(실제 권한 체크용)
    orderingRole: "신청자" as "신청자" | "관리자",
    auditRole: "신청자" as "신청자" | "관리자",
    // UI/레거시용 권한(any_admin 규칙으로 자동 산출)
    role: "신청자" as "신청자" | "관리자",
    active: "Y",
  });
  const [processing, setProcessing] = useState(false);
  const [showTeamManagementModal, setShowTeamManagementModal] = useState(false);
  const [regionTeams, setRegionTeams] = useState<RegionTeam[]>([]);

  const getUiRoleFromSystemRoles = useCallback(
    (
      orderingRole: "신청자" | "관리자" | string | undefined,
      auditRole: "신청자" | "관리자" | string | undefined,
    ): "신청자" | "관리자" => {
      return orderingRole === "관리자" || auditRole === "관리자"
        ? "관리자"
        : "신청자";
    },
    [],
  );

  const updateSystemRoles = useCallback(
    (updates: Partial<Pick<typeof formData, "orderingRole" | "auditRole">>) => {
      setFormData((prev) => {
        const next = { ...prev, ...updates };
        return {
          ...next,
          role: getUiRoleFromSystemRoles(next.orderingRole, next.auditRole),
        };
      });
    },
    [getUiRoleFromSystemRoles],
  );

  const showRequiredFieldAlert = (label: string) => {
    alert(`${label} 란을 입력하세요.`);
    return;
  };

  const focusFieldByName = (name: string) => {
    const el = document.querySelector<HTMLElement>(`[name="${name}"]`);
    if (el && "focus" in el) {
      (
        el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      ).focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // user의 role을 메모이제이션하여 안정적인 참조 생성
  const isUserAdmin = useMemo(() => user && isOrderingAdmin(user), [user?.orderingRole, user?.role]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);

      setToast(null);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }
      const data = await getAllUsers(sessionToken);
      setUsers(data);
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setToast({
        message: err.message || "사용자 목록을 불러오는 중 오류가 발생했습니다.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadRegionTeams = useCallback(async () => {
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        return;
      }
      const data = await getRegionTeams(sessionToken);
      setRegionTeams(data);
    } catch (err: any) {
      console.error("Failed to load region teams:", err);
      setToast({
        message: err.message || "지역/팀 목록을 불러오는 중 오류가 발생했습니다.",
        type: "error",
      });
    }
  }, []);

  // 사용 가능한 지역 목록 추출 (필터용 - 기존 사용자 데이터에서)
  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    users.forEach((u) => {
      if (u.region) {
        regions.add(u.region);
      }
    });
    return Array.from(regions).sort();
  }, [users]);

  // 선택한 지역에 속한 팀 목록 추출 (필터용 - 기존 사용자 데이터에서)
  const availableTeams = useMemo(() => {
    if (regionFilter === "all") {
      return [];
    }
    const teams = new Set<string>();
    users.forEach((u) => {
      if (u.region === regionFilter && u.team) {
        teams.add(u.team);
      }
    });
    return Array.from(teams).sort();
  }, [users, regionFilter]);

  // 모달용 지역 목록 (활성화된 지역/팀 데이터에서)
  const modalRegions = useMemo(() => {
    const regions = new Set<string>();
    regionTeams
      .filter((rt) => rt.active === "Y")
      .forEach((rt) => {
        if (rt.region) {
          regions.add(rt.region);
        }
      });
    return Array.from(regions).sort();
  }, [regionTeams]);

  // 모달용 팀 목록 (선택된 지역에 따라)
  const modalTeams = useMemo(() => {
    if (!formData.region) {
      return [];
    }
    const teams = new Set<string>();
    regionTeams
      .filter((rt) => rt.active === "Y" && rt.region === formData.region)
      .forEach((rt) => {
        if (rt.team) {
          teams.add(rt.team);
        }
      });
    return Array.from(teams).sort();
  }, [regionTeams, formData.region]);

  // 지역 필터 변경 시 팀 필터 초기화
  useEffect(() => {
    if (regionFilter === "all") {
      setTeamFilter("all");
    } else if (!availableTeams.includes(teamFilter) && teamFilter !== "all") {
      setTeamFilter("all");
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
      filtered = filtered.filter(
        (u) =>
          String(u.userId || "")
            .toLowerCase()
            .includes(term) ||
          String(u.name || "")
            .toLowerCase()
            .includes(term) ||
          String(u.team || "")
            .toLowerCase()
            .includes(term),
      );
    }

    // 권한 필터
    if (roleFilter !== "all") {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    // 지역 필터
    if (regionFilter !== "all") {
      filtered = filtered.filter((u) => u.region === regionFilter);
    }

    // 팀 필터 (지역이 선택된 경우에만 적용)
    if (regionFilter !== "all" && teamFilter !== "all") {
      filtered = filtered.filter((u) => u.team === teamFilter);
    }

    // 정렬
    if (sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;

        if (sortBy === "name") {
          const nameA = String(a.name || "").toLowerCase();
          const nameB = String(b.name || "").toLowerCase();
          comparison = nameA.localeCompare(nameB, "ko");
        } else if (sortBy === "employeeCode") {
          const codeA = String(a.employeeCode || "").toLowerCase();
          const codeB = String(b.employeeCode || "").toLowerCase();
          comparison = codeA.localeCompare(codeB, "ko");
        } else if (sortBy === "regionTeam") {
          // 지역 먼저 정렬, 그 다음 팀
          const regionA = String(a.region || "").toLowerCase();
          const regionB = String(b.region || "").toLowerCase();
          const regionComparison = regionA.localeCompare(regionB, "ko");
          if (regionComparison !== 0) {
            comparison = regionComparison;
          } else {
            const teamA = String(a.team || "").toLowerCase();
            const teamB = String(b.team || "").toLowerCase();
            comparison = teamA.localeCompare(teamB, "ko");
          }
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
    } else {
      // sortBy가 null일 때: DB에 쌓은 순 내림차순 (최신 것이 위에)
      filtered.reverse();
    }

    setFilteredUsers(filtered);
  }, [
    users,
    searchTerm,
    roleFilter,
    regionFilter,
    teamFilter,
    sortBy,
    sortOrder,
  ]);

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
      alert("접근 권한이 없습니다.");
      navigate("/dashboard", { replace: true });
      return;
    }
    loadUsers();
    loadRegionTeams();
  }, [isUserAdmin, loadUsers, loadRegionTeams, navigate]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      userId: "",
      password: "",
      name: "",
      employeeCode: "",
      team: "",
      region: "",
      orderingRole: "신청자",
      auditRole: "신청자",
      role: "신청자",
      active: "Y",
    });
    loadRegionTeams(); // 최신 데이터 로드
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    const orderingRole = user.orderingRole === "관리자" ? "관리자" : "신청자";
    const auditRole = user.auditRole === "관리자" ? "관리자" : "신청자";
    const uiRole = getUiRoleFromSystemRoles(orderingRole, auditRole);

    setEditingUser(user);
    setFormData({
      userId: user.userId,
      password: "",
      name: user.name || "",
      employeeCode: user.employeeCode || "",
      team: user.team || "",
      region: user.region || "",
      orderingRole,
      auditRole,
      role: uiRole,
      active: user.active || "Y",
    });
    loadRegionTeams(); // 최신 데이터 로드
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(`정말로 사용자 "${userId}"를 비활성화하시겠습니까?`)) {
      return;
    }

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }
      const result = await deleteUser(userId, sessionToken);
      if (result.success) {
        await loadUsers();
        // alert(result.message || "사용자가 비활성화되었습니다.");
        setToast({
          message: result.message || "사용자가 비활성화되었습니다.",
          type: "success",
        });
      } else {
        const errorMsg = result.message || "사용자 비활성화에 실패했습니다.";

        setToast({
          message: errorMsg,
          type: "error",
        });
        // alert(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || "사용자 비활성화 중 오류가 발생했습니다.";

      setToast({
        message: errorMsg,
        type: "error",
      });
      // alert(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleSort = (key: string) => {
    const column = key as "name" | "employeeCode" | "regionTeam";
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // 테이블 컬럼 설정 - 여기서 쉽게 헤더 관리 가능
  const columns: TableColumn<User>[] = useMemo(
    () => [
      {
        key: "userId",
        label: "사용자ID",
        sortable: false,
      },
      {
        key: "name",
        label: "이름",
        sortable: true,
        sortKey: "name",
      },
      {
        key: "employeeCode",
        label: "기사코드",
        sortable: true,
        sortKey: "employeeCode",
      },
      {
        key: "regionTeam",
        label: "소속 지역 / 팀",
        sortable: true,
        sortKey: "regionTeam",
        render: (_, row) => `${row.region || ""} - ${row.team || ""}`,
      },
      {
        key: "role",
        label: "통합 권한",
        sortable: false,
      },
      {
        key: "orderingRole",
        label: "부품발주 권한",
        sortable: false,
        render: (value) => (value ? String(value) : "-"),
      },
      {
        key: "auditRole",
        label: "정비실사 권한",
        sortable: false,
        render: (value) => (value ? String(value) : "-"),
      },
      {
        key: "active",
        label: "활성화",
        sortable: false,
        render: (value) => (value === "Y" ? "활성" : "비활성"),
      },
      {
        key: "actions",
        label: "데이터 변경",
        sortable: false,
        render: (_, row) => {
          const isInactive = row.active === "N";
          return (
            <div className="flex gap-2">
              <Button
                onClick={() => handleEdit(row)}
                className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                disabled={isInactive || processing}
                variant="icon"
                icon={Edit}
                title={isInactive ? "비활성화된 사용자는 수정할 수 없습니다." : "수정"}
              />
              <Button
                onClick={() => handleDelete(row.userId)}
                className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                disabled={isInactive || processing}
                variant="icon"
                icon={Trash2}
                title={isInactive ? "이미 비활성화된 사용자입니다." : "비활성화"}
              />
            </div>
          );
        },
      },
    ],
    [processing],
  );

  const handleSave = async () => {
    try {
      setProcessing(true);

      setToast(null);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }

      // 모달의 모든 필드는 필수 (등록/수정 동일)
      const requiredFields: Array<{
        name: keyof typeof formData;
        label: string;
        isMissing: () => boolean;
      }> = [
          {
            name: "userId",
            label: "사용자 아이디",
            isMissing: () => !String(formData.userId || "").trim(),
          },
          {
            name: "password",
            label: "비밀번호",
            isMissing: () => !String(formData.password || "").trim(),
          },
          {
            name: "name",
            label: "이름",
            isMissing: () => !String(formData.name || "").trim(),
          },
          {
            name: "employeeCode",
            label: "기사코드",
            isMissing: () => !String(formData.employeeCode || "").trim(),
          },
          {
            name: "region",
            label: "소속 지역",
            isMissing: () => !String(formData.region || "").trim(),
          },
          {
            name: "team",
            label: "소속 팀",
            isMissing: () => !String(formData.team || "").trim(),
          },
          {
            name: "active",
            label: "활성화",
            isMissing: () => !String(formData.active || "").trim(),
          },
        ];

      const firstMissing = requiredFields.find((f) => f.isMissing());
      if (
        (firstMissing && firstMissing.name !== "password") ||
        (firstMissing && firstMissing.name === "password" && !editingUser)
      ) {
        showRequiredFieldAlert(firstMissing.label);
        focusFieldByName(String(firstMissing.name));
        return;
      }

      // 비밀번호 길이 검증 (6자리 이상)
      if (formData.password && formData.password.length < 6) {
        alert("비밀번호는 6자리 이상만 가능합니다.");
        const passwordInput = document.querySelector(
          'input[type="password"]',
        ) as HTMLInputElement;
        if (passwordInput) {
          passwordInput.focus();
          passwordInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      let result;
      if (editingUser) {
        const uiRole = getUiRoleFromSystemRoles(
          formData.orderingRole,
          formData.auditRole,
        );
        // 수정
        result = await updateUser(
          editingUser.userId,
          {
            name: formData.name,
            employeeCode: formData.employeeCode,
            team: formData.team,
            region: formData.region,
            // 시스템별 role + 레거시/UI role(any_admin)
            orderingRole: formData.orderingRole,
            auditRole: formData.auditRole,
            role: uiRole,
            active: formData.active,
            password: formData.password, // 해시용
            passwordPlain: formData.password, // 평문 비밀번호 (구글 시트 '비밀번호' 컬럼에 저장)
          },
          sessionToken,
        );
      } else {
        const uiRole = getUiRoleFromSystemRoles(
          formData.orderingRole,
          formData.auditRole,
        );
        // 등록
        result = await createUser(
          {
            userId: formData.userId,
            password: formData.password, // 해시용
            passwordPlain: formData.password, // 평문 비밀번호 (구글 시트 '비밀번호' 컬럼에 저장)
            name: formData.name,
            employeeCode: formData.employeeCode,
            team: formData.team,
            region: formData.region,
            // 시스템별 role + 레거시/UI role(any_admin)
            orderingRole: formData.orderingRole,
            auditRole: formData.auditRole,
            role: uiRole,
            active: formData.active,
          },
          sessionToken,
        );
      }

      if (result.success) {
        const successMsg =
          result.message ||
          (editingUser
            ? "사용자 정보가 수정되었습니다."
            : "사용자가 등록되었습니다.");
        setShowModal(false);
        setEditingUser(null);
        alert(successMsg);
        await loadUsers();
      } else {
        const errorMsg = result.message || "저장에 실패했습니다.";

        setToast({
          message: errorMsg,
          type: "error",
        });
        // alert(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || "저장 중 오류가 발생했습니다.";

      setToast({
        message: errorMsg,
        type: "error",
      });
      // alert(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="데이터를 불러오는 중..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {processing && (
        <LoadingOverlay
          message={
            editingUser
              ? "사용자 정보를 수정하는 중..."
              : showModal
                ? "사용자를 등록하는 중..."
                : "처리 중..."
          }
        />
      )}
      <div className="max-w-[85dvw] mx-auto px-4 sm:px-6 lg:px-8">
        <Header
          headerTitle="사용자 관리"
          headerSubTitle="기준 정보 관리"
          level={1}
        />

        <div className="mb-6 flex justify-end items-center gap-2">
          <Button
            onClick={async () => {
              if (!window.confirm('변경 대상 비밀번호 열의 값으로 모든 사용자의 비밀번호를 일괄 변경하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
                return;
              }
              try {
                setProcessing(true);
                const sessionToken = getSessionToken();
                if (!sessionToken) {
                  alert('로그인이 필요합니다.');
                  return;
                }
                const result = await bulkUpdatePasswordsFromTargetColumn(sessionToken);
                if (result.success) {
                  setToast({
                    message: result.message || `${result.count || 0}명의 비밀번호가 변경되었습니다.`,
                    type: "success",
                  });
                  await loadUsers();
                } else {
                  setToast({
                    message: result.message || '일괄 비밀번호 변경에 실패했습니다.',
                    type: "error",
                  });
                }
              } catch (err: any) {
                console.error('Failed to bulk update passwords:', err);
                setToast({
                  message: err.message || '일괄 비밀번호 변경 중 오류가 발생했습니다.',
                  type: "error",
                });
              } finally {
                setProcessing(false);
              }
            }}
            disabled={processing}
            variant="secondary"
            icon={RefreshCw}
            className="hidden"
          >
            비밀번호 일괄 변경
          </Button>
          <Button
            onClick={() => setShowTeamManagementModal(true)}
            variant="success"
            icon={Users}
          >
            팀 관리
          </Button>
          <Button
            onClick={handleCreate}
            variant="primary"
            icon={Plus}
          >
            사용자 등록
          </Button>
        </div>
        {/* 검색 및 필터 */}
        <div className="mb-6 flex flex-row items-center justify-between gap-2">
          {/* 검색 입력 */}
          <div className="relative flex-1 flex">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              data-type="search"
              placeholder="사용자 ID, 이름, 소속팀으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              required={true}
            />
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap gap-2">
            {/* 권한 필터 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 hidden ">
                권한:
              </label>
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as "all" | "관리자" | "신청자")
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white w-[150px]"
              >
                <option value="all">권한 전체</option>
                <option value="관리자">관리자</option>
                <option value="신청자">신청자</option>
              </select>
            </div>

            {/* 지역 필터 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 hidden">
                지역:
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[150px]"
              >
                <option value="all">지역 전체</option>
                {availableRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* <label className="text-sm font-medium text-gray-700">팀:</label> */}
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
              >
                <option value="all">팀 전체</option>
                {availableTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setRegionFilter("all");
              setTeamFilter("all");
              setSearchTerm("");
              setRoleFilter("all");
            }}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4${loading ? "animate-spin" : ""}`}
            />
            초기화
          </Button>
        </div>

        {/* 테이블 */}
        <DataTable
          data={filteredUsers}
          columns={columns}
          getRowClassName={(row) => row.active === "N" ? "opacity-50 bg-gray-100" : ""}
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
                {editingUser ? "사용자 수정" : "사용자 등록"}
              </h3>
              {/* {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm font-bold">{error}</p>
                </div>
              )} */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사용자 아이디 {<span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    name="userId"
                    value={formData.userId}
                    label="사용자 아이디"
                    onChange={(e) =>
                      setFormData({ ...formData, userId: e.target.value })
                    }
                    required={true}
                    disabled={!!editingUser}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비밀번호{" "}
                    {editingUser ? (
                      <span className="text-gray-500 text-xs">
                        (변경 시에만 입력)
                      </span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    label="비밀번호"
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required={true}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    label="이름"
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required={true}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기사코드 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="employeeCode"
                      value={formData.employeeCode}
                      label="기사코드"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          employeeCode: e.target.value,
                        })
                      }
                      required={true}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      통합 권한(자동)
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 font-semibold">
                      {formData.role}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      부품발주 권한 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="orderingRole"
                      value={formData.orderingRole}
                      onChange={(e) =>
                        updateSystemRoles({
                          orderingRole: e.target.value as "신청자" | "관리자",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="신청자">신청자</option>
                      <option value="관리자">관리자</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      정비실사 권한 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="auditRole"
                      value={formData.auditRole}
                      onChange={(e) =>
                        updateSystemRoles({
                          auditRole: e.target.value as "신청자" | "관리자",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="신청자">신청자</option>
                      <option value="관리자">관리자</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      소속 지역 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="region"
                      value={formData.region}
                      onChange={(e) => {
                        setFormData({ ...formData, region: e.target.value, team: "" }); // 지역 변경 시 팀 초기화
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={true}
                    >
                      <option value="">지역을 선택하세요</option>
                      {modalRegions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      소속 팀 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="team"
                      value={formData.team}
                      onChange={(e) =>
                        setFormData({ ...formData, team: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={true}
                      disabled={!formData.region}
                    >
                      <option value="">팀을 선택하세요</option>
                      {modalTeams.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    활성화 <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="active"
                    value={formData.active}
                    label="활성화"
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Y">활성</option>
                    <option value="N">비활성</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                  }}
                  variant="outline"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={processing}
                  variant="primary"
                >
                  {processing ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
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

      {/* 팀 관리 모달 */}
      <TeamManagementModal
        isOpen={showTeamManagementModal}
        onClose={() => setShowTeamManagementModal(false)}
        onUpdate={() => {
          loadUsers();
          loadRegionTeams(); // 팀 관리 모달에서 업데이트 시 지역/팀 목록도 새로고침
        }}
      />
    </div>
  );
};

export default AdminUserManagementPage;
