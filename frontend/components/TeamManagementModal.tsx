import React, { useState, useEffect, useMemo } from "react";
import { X, Plus, Edit, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  getRegionTeams,
  createRegionTeam,
  updateRegionTeam,
  deleteRegionTeam,
} from "../services/adminService";
import { RegionTeam } from "../types/ordering";
import { getSessionToken } from "../utils/orderingAuth";

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const TeamManagementModal: React.FC<TeamManagementModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [regionTeams, setRegionTeams] = useState<RegionTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<{ region: string; team: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    region: "",
    team: "",
  });

  // 지역별로 그룹화
  const groupedData = useMemo(() => {
    const grouped: Record<string, RegionTeam[]> = {};
    regionTeams
      .filter((item) => item.active === "Y")
      .forEach((item) => {
        if (!grouped[item.region]) {
          grouped[item.region] = [];
        }
        grouped[item.region].push(item);
      });
    return grouped;
  }, [regionTeams]);

  // 지역 목록 (정렬)
  const regions = useMemo(() => {
    return Object.keys(groupedData).sort();
  }, [groupedData]);

  useEffect(() => {
    if (isOpen) {
      loadRegionTeams();
      // 모든 지역을 기본적으로 펼침
      const allRegions = new Set(regions);
      setExpandedRegions(allRegions);
    } else {
      setRegionTeams([]);
      setExpandedRegions(new Set());
      setShowAddForm(false);
      setEditingItem(null);
      setFormData({ region: "", team: "" });
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && regions.length > 0) {
      const allRegions = new Set(regions);
      setExpandedRegions(allRegions);
    }
  }, [regions, isOpen]);

  const loadRegionTeams = async () => {
    try {
      setLoading(true);
      setError("");
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        setError("로그인이 필요합니다.");
        return;
      }
      const data = await getRegionTeams(sessionToken);
      setRegionTeams(data);
    } catch (err: any) {
      console.error("Failed to load region teams:", err);
      setError(err.message || "지역-팀 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRegion = (region: string) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(region)) {
      newExpanded.delete(region);
    } else {
      newExpanded.add(region);
    }
    setExpandedRegions(newExpanded);
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setEditingItem(null);
    setFormData({ region: "", team: "" });
  };

  const handleEdit = (region: string, team: string) => {
    setEditingItem({ region, team });
    setFormData({ region, team });
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingItem(null);
    setFormData({ region: "", team: "" });
  };

  const handleSave = async () => {
    if (!formData.region.trim() || !formData.team.trim()) {
      alert("지역과 팀을 모두 입력하세요.");
      return;
    }

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        alert("로그인이 필요합니다.");
        return;
      }

      if (editingItem) {
        // 수정
        const result = await updateRegionTeam(
          {
            oldRegion: editingItem.region,
            oldTeam: editingItem.team,
            newRegion: formData.region.trim(),
            newTeam: formData.team.trim(),
          },
          sessionToken
        );

        if (result.success) {
          alert(result.message || "지역-팀이 수정되었습니다.");
          await loadRegionTeams();
          if (onUpdate) onUpdate();
          handleCancel();
        } else {
          alert(result.message || "수정에 실패했습니다.");
        }
      } else {
        // 추가
        const result = await createRegionTeam(
          {
            region: formData.region.trim(),
            team: formData.team.trim(),
          },
          sessionToken
        );

        if (result.success) {
          alert(result.message || "지역-팀이 추가되었습니다.");
          await loadRegionTeams();
          if (onUpdate) onUpdate();
          handleCancel();
        } else {
          alert(result.message || "추가에 실패했습니다.");
        }
      }
    } catch (err: any) {
      console.error("Failed to save region team:", err);
      alert(err.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (region: string, team: string, deleteRegion: boolean = false) => {
    const confirmMessage = deleteRegion
      ? `정말 "${region}" 지역과 모든 팀을 비활성화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
      : `정말 "${region} - ${team}"을 비활성화하시겠습니까?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        alert("로그인이 필요합니다.");
        return;
      }

      const result = await deleteRegionTeam(
        {
          region,
          team: deleteRegion ? undefined : team,
          deleteRegion,
        },
        sessionToken
      );

      if (result.success) {
        alert(result.message || "삭제되었습니다.");
        await loadRegionTeams();
        if (onUpdate) onUpdate();
      } else {
        alert(result.message || "삭제에 실패했습니다.");
      }
    } catch (err: any) {
      console.error("Failed to delete region team:", err);
      alert(err.message || "삭제 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-black text-gray-900">팀 관리</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={processing}
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">로딩 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-bold">{error}</p>
              <button
                onClick={loadRegionTeams}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* 추가/수정 폼 */}
              {(showAddForm || editingItem) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    {editingItem ? "지역-팀 수정" : "지역-팀 추가"}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        지역 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) =>
                          setFormData({ ...formData, region: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="지역을 입력하세요"
                        disabled={processing}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        팀 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.team}
                        onChange={(e) =>
                          setFormData({ ...formData, team: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="팀을 입력하세요"
                        disabled={processing}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={processing}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                      >
                        {processing ? "처리 중..." : editingItem ? "수정" : "추가"}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={processing}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 트리 구조 */}
              <div className="space-y-2">
                {regions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>등록된 지역-팀이 없습니다.</p>
                  </div>
                ) : (
                  regions.map((region) => {
                    const teams = groupedData[region];
                    const isExpanded = expandedRegions.has(region);

                    return (
                      <div key={region} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* 지역 헤더 */}
                        <div
                          className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                          onClick={() => toggleRegion(region)}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            )}
                            <span className="font-bold text-gray-900">{region}</span>
                            <span className="text-sm text-gray-500">
                              ({teams.length}개 팀)
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(region, "", true);
                            }}
                            disabled={processing}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="지역 전체 비활성화"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 팀 목록 */}
                        {isExpanded && (
                          <div className="bg-white">
                            {teams.map((item, idx) => (
                              <div
                                key={`${item.region}-${item.team}-${idx}`}
                                className="flex items-center justify-between p-3 border-t border-gray-100 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-3 pl-8">
                                  <span className="text-gray-700">{item.team}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEdit(item.region, item.team)}
                                    disabled={processing}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="수정"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.region, item.team, false)}
                                    disabled={processing}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="비활성화"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleAdd}
            disabled={processing || showAddForm || editingItem !== null}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            <Plus className="w-4 h-4" />
            지역-팀 추가
          </button>
          <button
            onClick={onClose}
            disabled={processing}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamManagementModal;

