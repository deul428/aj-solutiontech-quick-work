
import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileUp,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Database,
  ClipboardCheck,
  ScanQrCode,
  Cloud,
  RefreshCcw,
  AlertCircle,
  ExternalLink,
  Link2,
  Info,
  ChevronRight,
  Layers,
  HelpCircle,
  Key,
  Package,
  Settings,
  Users,
  FileText
} from "lucide-react";
import { MasterDataRow } from "../../types";
import { parseMasterExcel } from "../../services/excelService";
import LoadingOverlay from "../../components/LoadingOverlay";
import { getCurrentUser, isAdmin, isUser, isLoggedIn } from "../../utils/orderingAuth";
import Header from "@/components/Header";

interface CountMasterPageProps {
  masterData: MasterDataRow[];
  setMasterData: React.Dispatch<React.SetStateAction<MasterDataRow[]>>;
  fileName: string | null;
  setFileName: React.Dispatch<React.SetStateAction<string | null>>;
  onNavigate: (view: "checklist" | "audit") => void;
  onRefresh: (customUrl?: string, sheetName?: string) => Promise<void>;
  lastSyncTime: string | null;
  serviceUrl: string;
  availableSheets: string[];
  selectedSheet: string | null;
  onSheetSwitch: (sheetName: string) => void;
}

const CountMasterPage: React.FC<CountMasterPageProps> = ({
  masterData,
  setMasterData,
  fileName,
  setFileName,
  onNavigate,
  onRefresh,
  lastSyncTime,
  serviceUrl,
  availableSheets,
  selectedSheet,
  onSheetSwitch
}) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUserState] = useState(getCurrentUser());

  // 사용자 정보 업데이트 감지
  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentUserState(getCurrentUser());
    };
    window.addEventListener('storage', handleStorageChange);
    // 컴포넌트 마운트 시 사용자 정보 확인
    setCurrentUserState(getCurrentUser());
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleNavigate = (view: "checklist" | "audit") => {
    if (view === "checklist") {
      navigate('/checklist');
    } else if (view === "audit") {
      navigate('/audit');
    } else {
      onNavigate(view);
    }
  };

  const handleNavigateToOrdering = (path: string) => {
    if (!isLoggedIn()) {
      navigate('/login', { state: { from: path } });
    } else {
      navigate(path);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempUrl, setTempUrl] = useState(serviceUrl);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const userIsAdmin = isAdmin(currentUser);
  const userIsUser = isUser(currentUser);

  // 구글 시트 URL (환경 변수에서 가져오거나 기본값 사용)
  const GOOGLE_SHEET_URL = (import.meta.env?.VITE_GOOGLE_SHEET_URL as string) || "https://docs.google.com/spreadsheets/d/1NXT2EBow1zWxmPsb7frN90e95qRH1mkY9DQUgCrsn2I/edit?usp=sharing";

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await parseMasterExcel(file);
      setMasterData(data);
      setFileName(file.name);
      alert("엑셀 파일 데이터가 로드되었습니다.");
    } catch (error) {
      console.error(error);
      alert("파일을 읽는 도중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefresh = async () => {
    setIsProcessing(true);
    try {
      await onRefresh(serviceUrl, selectedSheet || undefined);
    } catch (err) {
      console.error("Refresh failed:", err);
      alert("클라우드 연결에 실패했습니다. (Failed to fetch)\n\n하단의 '해결 방법'을 확인해 보세요.");
      setShowTroubleshoot(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTryNewConnect = async () => {
    if (!tempUrl.trim().startsWith("http")) {
      alert("올바른 URL 형식이 아닙니다.");
      return;
    }
    if (tempUrl.includes("docs.google.com/spreadsheets")) {
      alert("시트 주소(docs.google.com)가 아닌, 'Apps Script 웹 앱 배포 URL'을 입력해야 합니다.");
      return;
    }

    setIsProcessing(true);
    try {
      await onRefresh(tempUrl);
      alert("클라우드 데이터베이스 연결에 성공했습니다.");
      setShowTroubleshoot(false);
    } catch (err) {
      console.error("Connection failed:", err);
      alert("연결에 실패했습니다. URL을 다시 확인하거나 GAS 설정을 확인하세요.");
      setShowTroubleshoot(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      {isProcessing && <LoadingOverlay message="데이터 동기화 중..." />}

      <Header headerTitle="마스터 파일 관리" headerSubTitle="장비 점검, 실사, QR생성" level={1} />

      <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
        {/* Connection Status Section */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col h-full ring-1 ring-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-600" /> 데이터베이스 상태
            </h3>
            {masterData.length > 0 && (
              <button
                onClick={handleRefresh}
                className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all"
                title="동기화 새로고침"
              >
                <RefreshCcw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          {userIsAdmin && masterData.length > 0 && (
            <div className="mb-4">
              <a
                href={GOOGLE_SHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all flex items-center gap-2"
                title="데이터베이스 바로가기"
              >
                <ExternalLink className="w-4 h-4" />
                데이터베이스 바로가기
              </a>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center">
            {masterData.length > 0 ? (
              <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-100/30 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>

                {/* Multi-Sheet Tab List */}
                {availableSheets.length > 0 && (
                  <div className="mb-6 relative z-10">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> 사용 가능한 마스터 시트
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availableSheets.map((name) => (
                        <button
                          key={name}
                          onClick={() => onSheetSwitch(name)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${selectedSheet === name
                            ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                            : "bg-white text-gray-500 hover:bg-gray-100 border border-blue-100"
                            }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
                    <Cloud className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-blue-900 font-black text-lg leading-tight mb-1">
                      {selectedSheet || "연결됨"}
                    </h4>
                    <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">Active Database</p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-end border-b border-blue-100 pb-3">
                    <span className="text-gray-500 text-sm font-bold">마스터 데이터 수</span>
                    <span className="text-2xl font-black text-gray-900">{masterData.length.toLocaleString()} <small className="text-sm font-bold text-gray-400">건</small></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm font-bold">최근 동기화</span>
                    <span className="text-sm font-black text-blue-700 bg-white px-3 py-1 rounded-full border border-blue-100">{lastSyncTime || "방금 전"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 rounded-3xl p-6 border border-red-100 text-center animate-in fade-in slide-in-from-bottom-2">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h4 className="text-red-900 font-black text-lg mb-1">클라우드 연결 실패</h4>
                <p className="text-red-600 text-[11px] font-medium leading-relaxed mb-6">
                  마스터 데이터를 가져오지 못했습니다. (Failed to fetch)<br />아래 설정을 확인해 보세요.
                </p>

                <div className="space-y-4 text-left">
                  {/* Option 1: URL Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-red-400 uppercase ml-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> 앱스 스크립트 배포 URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tempUrl}
                        onChange={(e) => setTempUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/..."
                        className="flex-1 bg-white border border-red-200 px-3 py-3 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                      />
                      <button
                        onClick={handleTryNewConnect}
                        className="bg-blue-600 text-white px-4 py-3 rounded-xl font-black text-xs hover:bg-blue-700 transition-all shadow-md active:scale-95"
                      >
                        연결
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                    className="w-full flex items-center justify-center gap-2 text-[11px] font-black text-blue-600 hover:underline"
                  >
                    <HelpCircle className="w-3 h-3" /> {showTroubleshoot ? "가이드 닫기" : "GAS 권한 설정 해결 방법"}
                  </button>

                  {showTroubleshoot && (
                    <div className="bg-white/50 p-4 rounded-2xl border border-red-100 text-[10px] space-y-2 animate-in slide-in-from-top-2">
                      <p className="font-black text-red-700 flex items-center gap-1">
                        <Key className="w-3 h-3" /> 반드시 확인하세요!
                      </p>
                      <ul className="list-decimal list-inside space-y-1 text-gray-600 font-medium">
                        <li><b>배포 - 새 배포</b>를 클릭합니다.</li>
                        <li>유형은 <b>'웹 앱'</b>이어야 합니다.</li>
                        <li>액세스 권한은 <b>'모든 사용자(Anyone)'</b>로 설정해야 합니다.</li>
                        <li>스크립트 내 시트 이름이 <b>'마스터파일'</b>을 포함해야 합니다.</li>
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-red-100"></div>
                    <span className="text-[9px] text-red-200 font-black">또는</span>
                    <div className="flex-1 h-px bg-red-100"></div>
                  </div>

                  {/* Option 2: Manual Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-red-400 uppercase ml-1 flex items-center gap-1">
                      <FileUp className="w-3 h-3" /> 방법 2: 수동 엑셀 업로드
                    </label>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-white text-gray-600 border border-gray-200 py-3.5 rounded-xl font-black text-xs hover:bg-gray-50 transition-all shadow-sm border-dashed border-2 flex items-center justify-center gap-2"
                    >
                      엑셀 마스터 파일 선택
                    </button>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleManualUpload} accept=".xlsx, .xls" className="hidden" />
              </div>
            )}
          </div>
        </div>
        <div className="hidden">
          {/* Quick Access Section - Role 기반 메뉴 */}
          <div className="space-y-6 flex flex-col h-full">
            {/* 로그인하지 않은 경우 */}
            {!isLoggedIn() && (
              <div className="p-6 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 text-center">
                <div className="mb-6">
                  <Key className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-black text-gray-900 mb-3">로그인이 필요합니다</h3>
                  <p className="text-gray-500 text-sm leading-relaxed font-bold mb-6">
                    시스템을 사용하려면 먼저 로그인해 주세요.
                  </p>
                  <button
                    onClick={() => navigate('/login', { state: { from: '/' } })}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-colors"
                  >
                    로그인하기
                  </button>
                </div>
              </div>
            )}

            {/* 관리자 메뉴 */}
            {isLoggedIn() && userIsAdmin && (
              <>
                {/* 체크리스트 생성 - 관리자만 */}
                <div
                  onClick={() => handleNavigate("checklist")}
                  className={`p-8 sm:p-10 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group hover:shadow-blue-100 transition-all flex-1 flex flex-col justify-center relative overflow-hidden ${!masterData.length ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="bg-blue-100 p-4 rounded-3xl group-hover:bg-blue-600 transition-colors shadow-inner text-blue-600 group-hover:text-white">
                      <ClipboardCheck className="w-10 h-10" />
                    </div>
                    <ArrowRight className="w-8 h-8 text-gray-200 group-hover:text-blue-600 transition-transform group-hover:translate-x-2" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">체크리스트 생성</h3>
                  <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">관리번호를 입력하여 QR코드가 포함된 정비 체크리스트를 자동 생성합니다.</p>
                </div>

                {/* 부품 발주 시스템 - 관리자 */}
                <div
                  onClick={() => handleNavigateToOrdering('/ordering')}
                  className="p-6 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group hover:shadow-green-100 transition-all flex-1 flex flex-col justify-center relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="bg-green-100 p-4 rounded-3xl group-hover:bg-green-600 transition-colors shadow-inner text-green-600 group-hover:text-white">
                      <Package className="w-10 h-10" />
                    </div>
                    <ArrowRight className="w-8 h-8 text-gray-200 group-hover:text-green-600 transition-transform group-hover:translate-x-2" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">부품 발주 시스템</h3>
                  <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">부품 신청 현황, 상태 변경, 담당자 배정, 기준 정보 관리</p>
                </div>
              </>
            )}

            {/* 사용자 메뉴 */}
            {isLoggedIn() && userIsUser && (
              <>
                {/* 자산 실사 - 사용자 */}
                <div
                  onClick={() => handleNavigate("audit")}
                  className={`p-8 sm:p-10 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group hover:shadow-purple-100 transition-all flex-1 flex flex-col justify-center relative overflow-hidden ${!masterData.length ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="bg-purple-100 p-4 rounded-3xl group-hover:bg-purple-600 transition-colors shadow-inner text-purple-600 group-hover:text-white">
                      <ScanQrCode className="w-10 h-10" />
                    </div>
                    <ArrowRight className="w-8 h-8 text-gray-200 group-hover:text-purple-600 transition-transform group-hover:translate-x-2" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">실시간 자산 실사</h3>
                  <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">현장에서 QR을 스캔하여 정보를 대조하고 실사 결과를 즉시 기록합니다.</p>
                </div>

                {/* 부품 발주 시스템 - 사용자 */}
                <div
                  onClick={() => handleNavigateToOrdering('/ordering')}
                  className="p-6 sm:p-8 rounded-2xl bg-white shadow-2xl border border-gray-100 cursor-pointer group hover:shadow-green-100 transition-all flex-1 flex flex-col justify-center relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="bg-green-100 p-4 rounded-3xl group-hover:bg-green-600 transition-colors shadow-inner text-green-600 group-hover:text-white">
                      <Package className="w-10 h-10" />
                    </div>
                    <ArrowRight className="w-8 h-8 text-gray-200 group-hover:text-green-600 transition-transform group-hover:translate-x-2" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3 relative z-10">부품 발주 시스템</h3>
                  <p className="text-gray-500 text-sm leading-relaxed font-bold text-pretty relative z-10">내 신청 등록, 내 신청 내역 확인, 내 정보 변경</p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CountMasterPage;
