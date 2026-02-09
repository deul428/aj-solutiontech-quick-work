import React, { useState, useEffect, useMemo } from "react";
import { X, Plus, Edit, Trash2, ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import {
  getRegionTeams,
  createRegionTeam,
  updateRegionTeam,
  deleteRegionTeam,
} from "../services/adminService";
import { RegionTeam } from "../types/ordering";
import { getSessionToken } from "../utils/orderingAuth";
import Button from "./Button";

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
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<{ region: string; team: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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

  // 지역 목록 (정렬 및 검색 필터링)
  const regions = useMemo(() => {
    let regionList = Object.keys(groupedData).sort();

    // 검색어가 있으면 필터링
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      regionList = regionList.filter((region) => {
        // 지역명에 검색어가 포함되어 있는지 확인
        if (region.toLowerCase().includes(searchLower)) {
          return true;
        }
        // 해당 지역의 팀명에 검색어가 포함되어 있는지 확인
        const teams = groupedData[region];
        return teams.some((team) =>
          team.team.toLowerCase().includes(searchLower)
        );
      });
    }

    return regionList;
  }, [groupedData, searchTerm]);

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
      setSearchTerm("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && regions.length > 0) {
      // 검색어가 있으면 검색 결과 지역만 펼치기
      if (searchTerm.trim()) {
        const filteredRegions = new Set(regions);
        setExpandedRegions(filteredRegions);
      } else {
        // 검색어가 없으면 모든 지역 펼치기
        const allRegions = new Set(regions);
        setExpandedRegions(allRegions);
      }
    }
  }, [regions, isOpen, searchTerm]);

  const loadRegionTeams = async () => {
    try {
      setLoading(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        alert("로그인이 필요합니다.");
        return;
      }
      const data = await getRegionTeams(sessionToken);
      setRegionTeams(data);
    } catch (err: any) {
      console.error("Failed to load region teams:", err);
      alert(err.message || "지역/팀 목록을 불러오는 중 오류가 발생했습니다.");
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

  const handleAdd = (region?: string) => {
    setShowAddForm(true);
    setEditingItem(null);
    const regionStr = region ? String(region) : "";
    setFormData({ region: regionStr, team: "" });
  };

  const handleEdit = (region: string, team: string) => {
    setEditingItem({ region, team });
    setFormData({ region: String(region), team: String(team) });
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
          alert(result.message || "지역/팀이 수정되었습니다.");
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
          alert(result.message || "지역/팀이 추가되었습니다.");
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
      ? `정말 ${region} 지역 내 모든 팀을 비활성화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
      : `정말 ${team}팀 (${region})을 비활성화하시겠습니까?`;

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 data-class='modal-header' className='text-gray-900'>팀 관리</h3>
          <Button variant="icon" onClick={onClose} disabled={processing} size='md'>
            <X className="w-6 h-6 text-gray-500" />
          </Button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">로딩 중...</span>
            </div>
          ) : (
            <>
              {/* 추가/수정 폼 */}
              {(showAddForm || editingItem) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    {editingItem ? "지역/팀 수정" : "지역/팀 추가"}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        지역 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={String(formData.region || '')}
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
                        value={String(formData.team || '')}
                        onChange={(e) =>
                          setFormData({ ...formData, team: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="팀을 입력하세요"
                        disabled={processing}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="primary" onClick={handleSave} disabled={processing}
                      >
                        {processing ? "처리 중..." : editingItem ? "수정" : "추가"}
                      </Button>
                      <Button variant="gray" onClick={handleCancel} disabled={processing}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 검색 입력 */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    data-type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="지역명 또는 팀명으로 검색..."
                    disabled={processing}
                  />
                </div>
              </div>

              {/* 트리 구조 */}
              <div className="space-y-2 h-[500px]">
                {regions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>
                      {searchTerm.trim()
                        ? `"${searchTerm}"에 대한 검색 결과가 없습니다.`
                        : "등록된 지역/팀이 없습니다."}
                    </p>
                  </div>
                ) : (
                  regions.map((region) => {
                    const teams = groupedData[region];
                    const isExpanded = expandedRegions.has(region);

                    return (
                      <div key={region} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* 지역 헤더 */}
                        <div
                          className="flex items-center justify-between px-2 py-1 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
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
                          <div className="flex items-center gap-2">
                            <Button
                              variant=""
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdd(region);
                              }}
                              disabled={processing || showAddForm || editingItem !== null}
                              className="px-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                              title="팀 추가"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant=""
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(region, "", true);
                              }}
                              disabled={processing}
                              className="px-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="지역 전체 비활성화"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* 팀 목록 */}
                        {isExpanded && (
                          <div className="bg-white">
                            {teams
                              .filter((item) => {
                                // 검색어가 있으면 팀명도 필터링
                                if (searchTerm.trim()) {
                                  const searchLower = searchTerm.toLowerCase().trim();
                                  return item.team.toLowerCase().includes(searchLower) ||
                                    item.region.toLowerCase().includes(searchLower);
                                }
                                return true;
                              })
                              .map((item, idx) => (
                                <div
                                  key={`${item.region}-${item.team}-${idx}`}
                                  className="flex items-center justify-between px-2 py-1  border-t border-gray-100 hover:bg-gray-50 transition-colors text-sm"
                                >
                                  <div className="flex items-center gap-3 pl-8">
                                    <span className="text-gray-700">{item.team}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant=''
                                      onClick={() => handleEdit(item.region, item.team)}
                                      disabled={processing}
                                      className="px-2 text-blue-600 hover:bg-blue-50  disabled:opacity-50"
                                      title="수정"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant=''
                                      onClick={() => handleDelete(item.region, item.team, false)}
                                      disabled={processing}
                                      className="px-2 text-red-600 hover:bg-red-50  disabled:opacity-50"
                                      title="비활성화"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
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
        <div className="flex items-center justify-end gap-2 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="primary" onClick={() => handleAdd(null)} disabled={processing || showAddForm || editingItem !== null}
          >
            <Plus className="w-4 h-4" />
            새 지역 추가
          </Button>
          <Button variant="gray" onClick={onClose} disabled={processing}
          >
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TeamManagementModal;

