import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Download,
  Edit,
  UserPlus,
  Eye,
  X,
  Maximize2,
} from "lucide-react";
import {
  isAdmin,
  getCurrentUser,
  getSessionToken,
} from "../../utils/orderingAuth";
import {
  getAllRequestsOrdering,
  updateRequestStatusOrdering,
  assignHandlerOrdering,
  getRequestDetailOrdering,
  updateHandlerRemarksOrdering,
  PaginatedResult,
  ORDERING_GAS_URL,
} from "../../services/orderingService";
import { getAllUsers } from "../../services/adminService";
import { Request, User } from "../../types/ordering";
import {
  formatDate,
  getStatusColor,
  getImageUrl,
} from "../../utils/orderingHelpers";
import LoadingOverlay from "../../components/LoadingOverlay";
import DataTable, { TableColumn } from "../../components/DataTable";
import Toast from "../../components/Toast";
import Header from "@/components/Header";
import Button from "@/components/Button";

const OrderingAdminRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("requestNo");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHandlerModal, setShowHandlerModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRequest, setDetailRequest] = useState<Request | null>(null);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(
    new Set(),
  );
  const [newStatus, setNewStatus] = useState("");
  const [handlerName, setHandlerName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [detailRemarks, setDetailRemarks] = useState("");
  const [detailRequesterRemarks, setDetailRequesterRemarks] = useState("");
  const [originalDetailRemarks, setOriginalDetailRemarks] = useState("");
  const [originalDetailRequesterRemarks, setOriginalDetailRequesterRemarks] =
    useState("");
  const [processing, setProcessing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setPageSize(mobile ? 9999 : 10);
      setCurrentPage(1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // user의 userId를 메모이제이션하여 안정적인 참조 생성
  const userId = useMemo(() => user?.userId || null, [user?.userId]);
  const isUserAdmin = useMemo(() => user && isAdmin(user), [user?.role]);

  // loadRequests를 useCallback으로 메모이제이션
  // 클라이언트 측 필터링/페이징을 위해 전체 데이터를 가져옴
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }

      // 전체 데이터를 가져와서 클라이언트에서 필터링/페이징 처리
      // 서버 측 정렬은 사용하지 않고 클라이언트에서만 정렬
      // fetchOrderingData에서 이미 타임스탬프를 추가하므로 별도 캐시 파라미터 불필요
      const result = await getAllRequestsOrdering(
        ORDERING_GAS_URL,
        {
          page: 1,
          pageSize: 9999, // 전체 데이터를 가져옴
          // sortBy, sortOrder는 클라이언트에서 처리하므로 서버에 전달하지 않음
        },
        sessionToken,
      );

      const newRequests = Array.isArray(result) ? result : result.data || [];
      // 상태 업데이트 - 강제로 새 배열로 설정하여 리렌더링 보장
      setRequests([...newRequests]);
      setTotal(newRequests.length);
      setTotalPages(1);
    } catch (err: any) {
      console.error("Failed to load requests:", err);
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [navigate]); // sortBy, sortOrder 제거 - 클라이언트에서만 정렬

  const filterRequests = useCallback(() => {
    let filtered = [...requests];

    // 검색 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          String(req.requestNo || "")
            .toLowerCase()
            .includes(term) ||
          String(req.requesterName || "")
            .toLowerCase()
            .includes(term) ||
          String(req.itemName || "")
            .toLowerCase()
            .includes(term) ||
          String(req.status || "")
            .toLowerCase()
            .includes(term),
      );
    }

    // 상태 필터
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }


    setFilteredRequests(filtered);
  }, [requests, searchTerm, statusFilter]);

  // 정렬된 데이터 (클라이언트 측 정렬)
  const sortedAndFilteredRequests = useMemo(() => {
    let sorted = [...filteredRequests];

    if (sortBy) {
      sorted.sort((a, b) => {
        const aValue = a[sortBy as keyof Request] || "";
        const bValue = b[sortBy as keyof Request] || "";
        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [filteredRequests, sortBy, sortOrder]);

  // requests가 변경되면 자동으로 필터링 실행
  useEffect(() => {
    filterRequests();
  }, [filterRequests]);

  // requests가 직접 변경되면 필터링 실행 (이중 보장)
  useEffect(() => {
    if (requests.length > 0) {
      filterRequests();
    }
  }, [requests.length, filterRequests]); // requests.length 변경 시 필터링 실행



  useEffect(() => {
    // 권한 체크 (ProtectedAdminRoute에서 이미 체크하지만 이중 체크)
    if (!isUserAdmin) {
      alert("접근 권한이 없습니다.");
      navigate("/user", { replace: true });
      return;
    }
    loadRequests();
  }, [isUserAdmin, loadRequests, navigate]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };
  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedRequests.size === sortedAndFilteredRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(
        new Set(sortedAndFilteredRequests.map((r) => r.requestNo)),
      );
    }
  };


  // 테이블 컬럼 설정 - 여기서 쉽게 헤더 관리 가능
  const columns: TableColumn<Request>[] = useMemo(
    () => [
      {
        key: "checkbox",
        label: (
          <input
            type="checkbox"
            checked={
              selectedRequests.size === sortedAndFilteredRequests.length &&
              sortedAndFilteredRequests.length > 0
            }
            onChange={handleSelectAll}
            className=" rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        sortable: false,
        headerClassName: "w-12 text-center",
        render: (_, row) => (
          <input
            type="checkbox"
            checked={selectedRequests.has(row.requestNo)}
            onChange={() => handleSelectRequest(row.requestNo)}
            className="translate-y-[2px] rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
      },

      {
        key: "requestNo",
        label: "신청번호",
        sortable: true,
        sortKey: "requestNo",
        render: (value, row) => (
          <Button
            variant="link"
            onClick={() => handleShowDetail(row)}
            title="상세 보기"
          >
            {value}
          </Button>
        ),
      },
      {
        key: "status",
        label: "상태",
        sortable: true,
        sortKey: "status",
        render: (value) => (
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(value)}`}
          >
            {value}
          </span>
        ),
      },
      {
        key: "requestDate",
        label: "신청일시",
        sortable: true,
        sortKey: "requestDate",
        render: (value) => value || "-",
      },
      {
        key: "requester",
        label: "신청자",
        sortable: false,
        render: (_, row) => (
          <div>
            <p>{row.requesterName}</p>
            <p className="text-xs text-gray-500">
              {row.region} - {row.team}
            </p>
          </div>
        ),
      },
      {
        key: "itemName",
        label: "품명",
        sortable: false,
        render: (value, row) => (
          <Button
            variant="link"
            onClick={() => handleShowDetail(row)}
            title="상세 보기"
          >
            {value || "-"}
          </Button>
        ),
      },
      {
        key: "quantity",
        label: "수량",
        sortable: false,
        render: (value) => value || "-",
      },
      {
        key: "assetNo",
        label: "관리번호",
        sortable: false,
        render: (value, row) => (
          <Button
            variant="link"
            onClick={() => handleShowDetail(row)}
            title="상세 보기"
          >
            {value || "-"}
          </Button>
        ),
      },
      {
        key: "handler",
        label: "접수담당자",
        sortable: false,
        render: (value) => value || "-",
      },
    ],
    [selectedRequests],
  );

  const statusOptions = [
    "접수중",
    "발주완료(납기미정)",
    "발주완료(납기확인)",
    "처리완료",
    "접수취소",
  ];

  // 사용자 목록 로드
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const sessionToken = getSessionToken();
        if (!sessionToken) return;
        const userList = await getAllUsers(sessionToken);
        setUsers(userList);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    if (isUserAdmin) {
      loadUsers();
    }
  }, [isUserAdmin]);

  // 체크박스 선택/해제
  const handleSelectRequest = (requestNo: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestNo)) {
      newSelected.delete(requestNo);
    } else {
      newSelected.add(requestNo);
    }
    setSelectedRequests(newSelected);
  };

  // 상세 모달 열기
  const handleShowDetail = async (request: Request) => {
    setDetailRequest(request);
    setDetailRemarks(request.handlerRemarks || "");
    setDetailRequesterRemarks(request.remarks || "");
    setOriginalDetailRemarks(request.handlerRemarks || "");
    setOriginalDetailRequesterRemarks(request.remarks || "");
    setHasChanges(false);
    setShowDetailModal(true);
    /* 
        // 최신 데이터 로드
        try {
          const sessionToken = getSessionToken();
          if (!sessionToken) return;
          const detail = await getRequestDetailOrdering(
            ORDERING_GAS_URL,
            request.requestNo,
            sessionToken,
          );
          if (detail) {
            setDetailRequest(detail);
            setDetailRemarks(detail.handlerRemarks || "");
            setDetailRequesterRemarks(detail.remarks || "");
            setOriginalDetailRemarks(detail.handlerRemarks || "");
            setOriginalDetailRequesterRemarks(detail.remarks || "");
            setHasChanges(false);
          }
        } catch (err) {
          console.error("Failed to load detail:", err);
        } */
  };

  // 변경사항 감지
  useEffect(() => {
    if (detailRequest) {
      const remarksChanged = detailRemarks !== originalDetailRemarks;
      const requesterRemarksChanged =
        detailRequesterRemarks !== originalDetailRequesterRemarks;
      setHasChanges(remarksChanged || requesterRemarksChanged);
    }
  }, [
    detailRemarks,
    detailRequesterRemarks,
    originalDetailRemarks,
    originalDetailRequesterRemarks,
    detailRequest,
  ]);

  // 상세 모달의 모든 변경사항 저장
  const saveDetailChanges = async () => {
    if (!detailRequest) return;

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }

      // 접수 담당자 비고 업데이트
      if (detailRemarks !== originalDetailRemarks) {
        const result = await updateHandlerRemarksOrdering(
          ORDERING_GAS_URL,
          detailRequest.requestNo,
          detailRemarks,
          sessionToken,
        );

        if (!result.success) {
          setError(result.message || "접수 담당자 비고 저장에 실패했습니다.");
          setToast({
            message: result.message || "접수 담당자 비고 저장에 실패했습니다.",
            type: "error",
          });
          setProcessing(false);
          return;
        }
      }

      // 데이터 새로고침
      await loadRequests();
      setDetailRequest((prev) => {
        if (!prev) return prev;
        const updatedFromList = requests.find(
          (r) => r.requestNo === prev.requestNo,
        );
        return updatedFromList || prev;
      });

      setOriginalDetailRemarks(detailRemarks);
      setHasChanges(false);
      setToast({ message: "저장되었습니다.", type: "success" });


      /* const updated = await getRequestDetailOrdering(
        ORDERING_GAS_URL,
        detailRequest.requestNo,
        sessionToken,
      );
      if (updated) {
        setDetailRequest(updated);
        setDetailRemarks(updated.handlerRemarks || "");
        setDetailRequesterRemarks(updated.remarks || "");
        setOriginalDetailRemarks(updated.handlerRemarks || "");
        setOriginalDetailRequesterRemarks(updated.remarks || "");
        setHasChanges(false);
        setToast({ message: "저장되었습니다.", type: "success" });
      } */
    } catch (err: any) {
      setError(err.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  // 모달 닫기 (변경사항 확인)
  const handleCloseDetailModal = () => {
    if (hasChanges) {
      if (!confirm("저장되지 않은 변경사항이 있습니다. 정말 닫으시겠습니까?")) {
        return;
      }
    }
    setShowDetailModal(false);
    setDetailRequest(null);
    setDetailRemarks("");
    setDetailRequesterRemarks("");
    setOriginalDetailRemarks("");
    setOriginalDetailRequesterRemarks("");
    setHasChanges(false);
    setExpandedImage(null);
  };

  // 일괄 상태 변경
  const handleBatchStatusChange = () => {
    if (selectedRequests.size === 0) {
      setError("선택된 항목이 없습니다.");
      return;
    }
    setNewStatus("");
    setRemarks("");
    setShowStatusModal(true);
  };

  // 일괄 상태 변경 저장
  const saveBatchStatusChange = async () => {
    if (selectedRequests.size === 0 || !newStatus) return;

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }

      const requestNos: string[] = Array.from(selectedRequests);
      let successCount = 0;
      let failCount = 0;

      // 모든 업데이트 작업을 Promise 배열로 생성
      const updatePromises = requestNos.map(async (requestNo) => {
        try {
          const result = await updateRequestStatusOrdering(
            ORDERING_GAS_URL,
            requestNo,
            newStatus,
            remarks,
            undefined,
            undefined,
            sessionToken,
          );
          if (result.success) {
            successCount++;
            return { success: true, requestNo };
          } else {
            failCount++;
            return { success: false, requestNo };
          }
        } catch (err) {
          failCount++;
          return { success: false, requestNo };
        }
      });

      // 모든 업데이트 작업이 완료될 때까지 대기
      await Promise.all(updatePromises);
      if (successCount > 0) {
        setShowStatusModal(false);
        setSelectedRequests(new Set());

        // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
        setRequests((prevRequests) => {
          const updatedRequests = prevRequests.map((req) => {
            if (requestNos.includes(req.requestNo)) {
              return { ...req, status: newStatus };
            }
            return req;
          });
          return updatedRequests;
        });

        // 백그라운드에서 데이터 새로고침 (비동기)
        loadRequests().catch((err) => {
          console.error("saveBatchStatusChange: 데이터 새로고침 실패", err);
        });
        if (failCount > 0) {
          setError(`${successCount}건 성공, ${failCount}건 실패했습니다.`);
          setToast({
            message: `${successCount}건 성공, ${failCount}건 실패했습니다.`,
            type: "error",
          });
        } else {
          setToast({
            message: `${successCount}건의 상태가 변경되었습니다.`,
            type: "success",
          });
        }
      } else {
        setError("모든 항목의 상태 변경에 실패했습니다.");
        setToast({
          message: "모든 항목의 상태 변경에 실패했습니다.",
          type: "error",
        });
      }
    } catch (err: any) {
      setError(err.message || "일괄 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  // 일괄 담당자 배정
  const handleBatchHandlerAssign = () => {
    if (selectedRequests.size === 0) {
      setError("선택된 항목이 없습니다.");
      return;
    }
    setHandlerName("");
    setShowHandlerModal(true);
  };

  // 일괄 담당자 배정 저장
  const saveBatchHandlerAssign = async () => {
    if (selectedRequests.size === 0 || !handlerName.trim()) return;

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }

      // 사용자 목록에서 이름으로 찾기
      const matchedUser = users.find((u) => u.name === handlerName.trim());
      if (!matchedUser) {
        setError("배정자가 존재하지 않습니다.");
        setProcessing(false);
        return;
      }

      const requestNos: string[] = Array.from(selectedRequests);
      let successCount = 0;
      let failCount = 0;

      // 모든 배정 작업을 Promise 배열로 생성
      const assignPromises = requestNos.map(async (requestNo) => {
        try {
          const result = await assignHandlerOrdering(
            ORDERING_GAS_URL,
            requestNo,
            matchedUser.userId, // userId를 handlerEmail로 사용
            sessionToken,
          );
          if (result.success) {
            successCount++;
            return { success: true, requestNo };
          } else {
            failCount++;
            return { success: false, requestNo };
          }
        } catch (err) {
          failCount++;
          return { success: false, requestNo };
        }
      });

      // 모든 배정 작업이 완료될 때까지 대기
      await Promise.all(assignPromises);

      if (successCount > 0) {
        setShowHandlerModal(false);
        setSelectedRequests(new Set());

        // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
        setRequests((prevRequests) => {
          const updatedRequests = prevRequests.map((req) => {
            if (requestNos.includes(req.requestNo)) {
              return { ...req, handler: matchedUser.name };
            }
            return req;
          });
          return updatedRequests;
        });

        // 백그라운드에서 데이터 새로고침 (비동기)
        loadRequests().catch((err) => {
          console.error("saveBatchHandlerAssign: 데이터 새로고침 실패", err);
        });

        if (failCount > 0) {
          setError(`${successCount}건 성공, ${failCount}건 실패했습니다.`);
          setToast({
            message: `${successCount}건 성공, ${failCount}건 실패했습니다.`,
            type: "error",
          });
        } else {
          setToast({
            message: `${successCount}건의 담당자가 배정되었습니다.`,
            type: "success",
          });
        }
      } else {
        setError("모든 항목의 담당자 배정에 실패했습니다.");
        setToast({
          message: "모든 항목의 담당자 배정에 실패했습니다.",
          type: "error",
        });
      }
    } catch (err: any) {
      setError(err.message || "일괄 담당자 배정 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="데이터를 불러오는 중..." />;
  }

  console.log(detailRequest);
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Header
        headerTitle="부품 신청 현황 (전체 조회)"
        headerSubTitle="부품 발주 시스템"
        level={1}
      />
      <div className="max-w-[85dvw] mx-auto px-4 sm:px-4 lg:px-8">
        <div className="mb-6">
          <p className="mt-2 text-gray-600">총 {total}건의 신청이 있습니다.</p>
        </div>

        {/* 필터 및 검색 */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              data-type="search"
              placeholder="신청번호, 신청자, 품명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white w-[150px]"
          >
            <option value="all">전체 상태</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {/* 일괄 변경 버튼 */}
        <div className="mb-4 flex justify-end gap-2">
          <Button variant="primary" color="blue" onClick={handleBatchStatusChange}>
            일괄 상태 변경 ({selectedRequests.size}건)
          </Button>

          <Button variant="success" color="green" onClick={handleBatchHandlerAssign}>
            담당자 배정 ({selectedRequests.size}건)
          </Button>

          <Button variant="gray" onClick={() => setSelectedRequests(new Set())}>
            선택 해제
          </Button>
        </div>
        {/* 테이블 */}
        <div>
          <p className="mt-2 mb-2 text-red-600">
            데이터의 동기화가 다소 느릴 수 있습니다. 동기화가 되지 않을 경우,
            잠시 기다렸다 새로고침해 주세요.
          </p>
          <DataTable
            data={sortedAndFilteredRequests}
            columns={columns}
            sortBy={sortBy}
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
            keyExtractor={(row) => row.requestNo}
            emptyMessage="신청 내역이 없습니다."
            showPagination={!isMobile}
          />
        </div>

        {/* 일괄 상태 변경 모달 */}
        {showStatusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">
                일괄 상태 변경 ({selectedRequests.size}건)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    새 상태
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white w-full"
                  >
                    <option value="">상태를 선택하세요</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비고
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="비고를 입력하세요 (선택사항)"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="gray" onClick={() => {
                  setShowStatusModal(false);
                  setNewStatus("");
                  setRemarks("");
                }}>
                  취소
                </Button>
                <Button variant="primary" onClick={saveBatchStatusChange}
                  disabled={processing || !newStatus}>
                  {processing ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 일괄 담당자 배정 모달 */}
        {showHandlerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">
                담당자 배정 ({selectedRequests.size}건)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    담당자 이름
                  </label>
                  <input
                    type="text"
                    value={handlerName}
                    onChange={(e) => setHandlerName(e.target.value)}
                    placeholder="관리자 이름을 입력하세요"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    사용자 관리 시트에 등록된 관리자 이름을 정확히 입력하세요.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="gray" onClick={() => {
                  setShowHandlerModal(false);
                  setHandlerName("");
                }}>
                  취소
                </Button>
                <Button variant="success" onClick={saveBatchHandlerAssign}
                  disabled={processing || !handlerName.trim()}>
                  {processing ? "저장 중..." : "배정"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 상세 모달 */}
        {showDetailModal && detailRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full m-4 max-h-[90vh] overflow-y-auto">
              {/* 헤더 */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex justify-between items-center z-10">
                <h1 className="text-2xl font-bold text-gray-900">
                  신청 상세 정보
                </h1>
                <Button variant=""
                  onClick={handleCloseDetailModal}>
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="p-6 space-y-6">
                {/* 기본 정보 테이블 */}
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">
                      기본 정보
                    </h2>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50 w-1/4">
                          신청 번호
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.requestNo}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          신청 일시
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest?.requestDate}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          신청자
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          <div>
                            <p className="font-medium">
                              {detailRequest.requesterName}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {detailRequest.region} - {detailRequest.team}
                            </p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          현재 상태
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(detailRequest.status)}`}
                          >
                            {detailRequest.status}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 align-top text-sm font-medium text-gray-500 bg-gray-50">
                          신청자 비고
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequesterRemarks || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 부품 정보 테이블 */}
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">
                      부품 정보
                    </h2>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50 w-1/4">
                          부품 품명
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.itemName}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          모델명
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.modelName || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          수량
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.quantity}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          수령지
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.deliveryPlace}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          수령 연락처
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.phone || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                          업체명
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.company || "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 첨부사진 */}
                {detailRequest.photoUrl && (
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-800">
                        첨부사진
                      </h2>
                    </div>
                    <div className="p-6 bg-white">
                      <div className="flex justify-center">
                        <img
                          src={getImageUrl(detailRequest.photoUrl)}
                          alt="첨부사진"
                          className="max-h-[300px] h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md"
                          onClick={() =>
                            setExpandedImage(
                              getImageUrl(detailRequest.photoUrl!),
                            )
                          }
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-2">
                        클릭하면 원본 크기로 확대됩니다
                      </p>
                    </div>
                  </div>
                )}

                {/* 접수 담당자 및 비고 */}
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">
                      접수 담당자 및 비고
                    </h2>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50 w-1/4">
                          접수 담당자
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {detailRequest.handler || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 align-top text-sm font-medium text-gray-500 bg-gray-50">
                          접수 담당자 비고
                        </td>
                        <td className="px-4 py-4">
                          <textarea
                            value={detailRemarks}
                            onChange={(e) => setDetailRemarks(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={4}
                            placeholder="비고를 입력하세요"
                          />
                          <Button variant="primary" onClick={saveDetailChanges}
                            disabled={processing}>
                            {processing ? "저장 중..." : "저장"}
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer 버튼 */}
                {/* <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                  <Button variant="outlined" color="gray"
                    onClick={handleCloseDetailModal}
                    className="bg-gray-500 text-white hover:bg-gray-600"
                  >
                    닫기
                  </Button>
                </div> */}
              </div>
            </div>
          </div>
        )}

        {/* 확대된 이미지 모달 */}
        {expandedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]"
            onClick={() => setExpandedImage(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]">
              <Button variant=""
                onClick={() => setExpandedImage(null)}
                className="absolute top-0 right-0 text-white hover:text-gray-300 z-10"
              >
                <X className="w-6 h-6" />
              </Button>
              <img
                src={expandedImage}
                alt="확대된 이미지"
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
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

export default OrderingAdminRequestsPage;
