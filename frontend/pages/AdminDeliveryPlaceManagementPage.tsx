import "../App.css";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import {
  isAdmin,
  getCurrentUser,
  getSessionToken,
} from "../utils/orderingAuth";
import {
  getAllDeliveryPlaces,
  createDeliveryPlace,
  updateDeliveryPlace,
  deleteDeliveryPlace,
} from "../services/adminService";
import { DeliveryPlace } from "../types/ordering";
import LoadingOverlay from "../components/LoadingOverlay";
import DataTable, { TableColumn } from "../components/DataTable";
import Toast from "../components/Toast";
import Header from "@/components/Header";

const AdminDeliveryPlaceManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [places, setPlaces] = useState<DeliveryPlace[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<DeliveryPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<DeliveryPlace | null>(null);
  const [formData, setFormData] = useState({
    배송지명: "",
    소속팀: "",
    주소: "",
    연락처: "",
    담당자: "",
    활성화: "Y",
    비고: "",
  });
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // user의 role을 메모이제이션하여 안정적인 참조 생성
  const isUserAdmin = useMemo(() => user && isAdmin(user), [user?.role]);

  const loadPlaces = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }
      const data = await getAllDeliveryPlaces(sessionToken);
      setPlaces(data);
    } catch (err: any) {
      console.error("Failed to load delivery places:", err);
      setError(err.message || "배송지 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const filterPlaces = useCallback(() => {
    let filtered = [...places];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          String(p["배송지명"] || "")
            .toLowerCase()
            .includes(term) ||
          String(p["소속팀"] || "")
            .toLowerCase()
            .includes(term) ||
          String(p["주소"] || "")
            .toLowerCase()
            .includes(term),
      );
    }
    setFilteredPlaces(filtered);
  }, [places, searchTerm]);

  useEffect(() => {
    // 권한 체크 (ProtectedAdminRoute에서 이미 체크하지만 이중 체크)
    if (!isUserAdmin) {
      alert("접근 권한이 없습니다.");
      navigate("/user", { replace: true });
      return;
    }
    loadPlaces();
  }, [isUserAdmin, loadPlaces, navigate]);

  useEffect(() => {
    filterPlaces();
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
  }, [filterPlaces]);

  // 테이블 컬럼 설정 - 여기서 쉽게 헤더 관리 가능
  const columns: TableColumn<DeliveryPlace>[] = useMemo(
    () => [
      {
        key: "배송지명",
        label: "배송지명",
        sortable: true,
      },
      {
        key: "소속팀",
        label: "소속팀",
        sortable: true,
      },
      {
        key: "주소",
        label: "주소",
        sortable: false,
        className: "", // whitespace-nowrap 제거
      },
      {
        key: "연락처",
        label: "연락처",
        sortable: false,
      },
      {
        key: "담당자",
        label: "담당자",
        sortable: false,
      },
      {
        key: "활성화",
        label: "활성화",
        sortable: false,
        render: (value) => (value === "Y" ? "활성" : "비활성"),
      },
      {
        key: "actions",
        label: "작업",
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
              onClick={() => handleDelete(row["배송지명"])}
              disabled={processing}
              className="text-red-600 hover:text-red-900 disabled:text-gray-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [processing],
  );

  const handleCreate = () => {
    setEditingPlace(null);
    setFormData({
      배송지명: "",
      소속팀: "",
      주소: "",
      연락처: "",
      담당자: "",
      활성화: "Y",
      비고: "",
    });
    setShowModal(true);
  };

  const handleEdit = (place: DeliveryPlace) => {
    setEditingPlace(place);
    setFormData({
      배송지명: place["배송지명"] || "",
      소속팀: place["소속팀"] || "",
      주소: place["주소"] || "",
      연락처: place["연락처"] || "",
      담당자: place["담당자"] || "",
      활성화: place["활성화"] || "Y",
      비고: place["비고"] || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (placeName: string) => {
    if (!confirm(`정말로 배송지 "${placeName}"를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }
      const result = await deleteDeliveryPlace(placeName, sessionToken);
      if (result.success) {
        await loadPlaces();
        alert(result.message || "배송지가 삭제되었습니다.");
      } else {
        const errorMsg = result.message || "배송지 삭제에 실패했습니다.";
        setError(errorMsg);
        alert(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || "배송지 삭제 중 오류가 발생했습니다.";
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    try {
      setProcessing(true);
      setError("");
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        navigate("/login");
        return;
      }

      if (!formData["배송지명"]) {
        setError("배송지명은 필수입니다.");
        return;
      }

      let result;
      if (editingPlace) {
        // 수정
        result = await updateDeliveryPlace(
          editingPlace["배송지명"],
          formData,
          sessionToken,
        );
      } else {
        // 등록
        result = await createDeliveryPlace(formData, sessionToken);
      }

      if (result.success) {
        setShowModal(false);
        setEditingPlace(null);
        await loadPlaces();
        const successMsg = result.message || (editingPlace ? "배송지 정보가 수정되었습니다." : "배송지가 등록되었습니다.");
        alert(successMsg);
      } else {
        const errorMsg = result.message || "저장에 실패했습니다.";
        setError(errorMsg);
        alert(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || "저장 중 오류가 발생했습니다.";
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="데이터를 불러오는 중..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {processing && <LoadingOverlay message={editingPlace ? "배송지 정보를 수정하는 중..." : showModal ? "배송지를 등록하는 중..." : "배송지를 삭제하는 중..."} />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Header
          headerTitle="부품 배송지 관리"
          headerSubTitle="기준 정보 관리"
          level={1}
        />
        <div className="mb-6 flex justify-end items-center">
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            배송지 등록
          </button>
        </div>

        {/* 검색 */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              data-type="search"
              placeholder="배송지명, 소속팀, 주소로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* 테이블 */}
        <DataTable
          data={filteredPlaces}
          columns={columns}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 15, 30, 50]}
          keyExtractor={(row, index) => row["배송지명"] || String(index)}
          emptyMessage="등록된 배송지가 없습니다."
        />

        {/* 등록/수정 모달 */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingPlace ? "배송지 수정" : "배송지 등록"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    배송지명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData["배송지명"]}
                    onChange={(e) =>
                      setFormData({ ...formData, 배송지명: e.target.value })
                    }
                    disabled={!!editingPlace} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    소속팀
                  </label>
                  <input
                    type="text"
                    value={formData["소속팀"]}
                    onChange={(e) =>
                      setFormData({ ...formData, 소속팀: e.target.value })
                    } 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    주소
                  </label>
                  <input
                    type="text"
                    value={formData["주소"]}
                    onChange={(e) =>
                      setFormData({ ...formData, 주소: e.target.value })
                    } 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      연락처
                    </label>
                    <input
                      type="text"
                      value={formData["연락처"]}
                      onChange={(e) =>
                        setFormData({ ...formData, 연락처: e.target.value })
                      } 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      담당자
                    </label>
                    <input
                      type="text"
                      value={formData["담당자"]}
                      onChange={(e) =>
                        setFormData({ ...formData, 담당자: e.target.value })
                      } 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    활성화
                  </label>
                  <select
                    value={formData["활성화"]}
                    onChange={(e) =>
                      setFormData({ ...formData, 활성화: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Y">활성</option>
                    <option value="N">비활성</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비고
                  </label>
                  <textarea
                    value={formData["비고"]}
                    onChange={(e) =>
                      setFormData({ ...formData, 비고: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingPlace(null);
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
                  {processing ? "저장 중..." : "저장"}
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

export default AdminDeliveryPlaceManagementPage;
