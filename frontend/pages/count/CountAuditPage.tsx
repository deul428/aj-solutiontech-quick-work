
import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  ScanQrCode,
  CheckCircle,
  History,
  Package,
  XCircle,
  CameraOff,
  CloudUpload,
  X,
  Loader2,
  Check,
  ExternalLink,
  RefreshCcw,
  Camera,
  MapPin,
  Navigation,
  Send,
  Plus,
  Building,
  Beaker
} from "lucide-react";
import { MasterDataRow, MASTER_COLUMNS, AUDIT_COLUMNS } from "../../types";
import { syncAuditDataToCloud, fetchLocationOptions } from "../../services/excelService";

interface CountAuditPageProps {
  masterData: MasterDataRow[];
  setMasterData: React.Dispatch<React.SetStateAction<MasterDataRow[]>>;
  serviceUrl: string;
  selectedSheet?: string;
}

const MOCK_SCAN_DATA = [
  { mgmt: "CL25R101", asset: "81601812", code: "851BX458", name: "전동 입식 2.5톤 3단 6500", brand: "클라크", model: "CRX25", year: "2011", serial: "CRX205-1264-9659KF" },
  { mgmt: "CL25R103", asset: "81604289", code: "851BX160", name: "전동 입식 2.5톤 3단 7000", brand: "클라크", model: "CRX25FL", year: "2016", serial: "CRX205-0580-9957KF" },
  { mgmt: "TY10R102", asset: "81600882", code: "851BX166", name: "전동 입식 1톤 2단 3000", brand: "도요타", model: "7FBR10", year: "1900", serial: "7FBR10-11807" },
  { mgmt: "TY14R101", asset: "81600844", code: "851BX569", name: "전동 입식 1.4톤 2단 4000", brand: "도요타", model: "7FBR14", year: "2008", serial: "7FBR14-11284" },
  { mgmt: "TY15C104", asset: "81600881", code: "851BX135", name: "전동 삼륜형 1.5톤 2단 3000", brand: "도요타", model: "7FBE15", year: "1900", serial: "7FBE18-58507" },
  { mgmt: "TY15C107", asset: "81600895", code: "851BX273", name: "전동 좌식 1.5톤 2단 3000", brand: "도요타", model: "7FB15", year: "1900", serial: "7FB18-50926" },
  { mgmt: "TY15C109", asset: "81600897", code: "851BX341", name: "전동 좌식 1.5톤 2단 3000", brand: "도요타", model: "7FBL15", year: "2007", serial: "7FB18-17471" },
];

const CountAuditPage: React.FC<CountAuditPageProps> = ({ masterData, setMasterData, serviceUrl, selectedSheet }) => {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [foundRow, setFoundRow] = useState<MasterDataRow | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [auditHistory, setAuditHistory] = useState<MasterDataRow[]>([]);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // 계층형 위치 데이터 상태
  const [locationMapping, setLocationMapping] = useState<Record<string, string[]>>({});
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [isCustomCenter, setIsCustomCenter] = useState(false);
  const [isCustomZone, setIsCustomZone] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader-container";
  const SHARED_SHEET_URL = "https://docs.google.com/spreadsheets/d/1NXT2EBow1zWxmPsb7frN90e95qRH1mkY9DQUgCrsn2I/edit?usp=sharing";

  useEffect(() => {
    const audited = masterData.filter(row => row[AUDIT_COLUMNS.STATUS] === 'O');
    setAuditHistory([...audited].reverse());
  }, [masterData]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const rawData = await fetchLocationOptions(serviceUrl);
        let mapping: Record<string, string[]> = {};

        // 핵심: 서버에서 데이터가 어떤 형식으로 오든 프론트에서 재가공 (방어 코드)
        if (Array.isArray(rawData)) {
          // 서버가 로우 데이터(배열)를 보낸 경우 직접 가공
          rawData.forEach((row: any) => {
            const centerKey = Object.keys(row).find(k => k.includes("센터"));
            const zoneKey = Object.keys(row).find(k => k.includes("구역") || k.includes("위치"));

            if (centerKey && row[centerKey]) {
              const c = String(row[centerKey]).trim();
              const z = zoneKey ? String(row[zoneKey] || "").trim() : "";
              if (!c || c === "undefined" || c === "null" || c === "센터 구분") return;
              if (!mapping[c]) mapping[c] = [];
              if (z && z !== "undefined" && z !== "null" && z !== "구역 구분" && !mapping[c].includes(z)) {
                mapping[c].push(z);
              }
            }
          });
        } else if (typeof rawData === 'object' && rawData !== null) {
          // 서버가 이미 가공된 매핑 객체를 보낸 경우
          mapping = rawData;
        }

        // 각 구역 리스트 정렬
        Object.keys(mapping).forEach(k => mapping[k].sort());
        setLocationMapping(mapping);
      } catch (err) {
        console.error("Failed to load location options:", err);
        setLocationMapping({});
      }
    };
    loadOptions();
  }, [serviceUrl]);

  const startScanner = async () => {
    setCameraStatus('loading');
    setErrorMessage(null);
    if (html5QrCodeRef.current) {
      try { 
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop(); 
        }
      } catch (e) { 
        console.error("Error stopping scanner:", e);
      }
    }
    const html5QrCode = new Html5Qrcode(scannerId);
    html5QrCodeRef.current = html5QrCode;
    // qrbox 크기를 더 크게 설정하고, 전체 화면 스캔도 지원하도록 개선
    const config = { 
      fps: 10, 
      qrbox: { width: 300, height: 300 }, 
      aspectRatio: 1.0, 
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      disableFlip: false,
      rememberLastUsedCamera: true
    };
    try {
      await html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText, decodedResult) => {
          console.log("QR Code scanned:", decodedText);
          handleScanSuccess(decodedText);
        }, 
        (errorMessage) => {
          // 에러는 무시하되, 스캔은 계속 진행
          // console.log("Scan error (ignored):", errorMessage);
        }
      );
      setCameraStatus('ready');
    } catch (err: any) {
      console.error("Camera start error:", err);
      setCameraStatus('error');
      setErrorMessage("카메라를 시작할 수 없습니다. 카메라 사용 권한을 확인하세요.");
    }
  };

  useEffect(() => {
    startScanner();
    return () => { 
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((e) => { 
          console.error("Error stopping scanner on cleanup:", e);
        }); 
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScanSuccess = (decodedText: string) => {
    // 조건 체크를 먼저 수행하여 불필요한 처리 방지
    if (showScanModal || showTransferModal || isCoolingDown || isSyncing) {
      console.log("Scan ignored - modal or process active");
      return;
    }
    
    const trimmedText = decodedText.trim();
    console.log("Processing scanned text:", trimmedText);
    
    if (!trimmedText) {
      console.warn("Empty scanned text");
      return;
    }
    
    setScannedResult(trimmedText);
    const match = masterData.find(row => {
      const mgmtNo = String(row[MASTER_COLUMNS.MGMT_NO] || "").trim();
      const assetNo = String(row[MASTER_COLUMNS.ASSET_NO] || "").trim();
      return mgmtNo === trimmedText || assetNo === trimmedText;
    });
    
    console.log("Match found:", match ? "Yes" : "No");
    setFoundRow(match || null);
    setShowScanModal(true);
    
    // 스캔 일시 정지
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        html5QrCodeRef.current.pause();
      } catch (e) {
        console.error("Error pausing scanner:", e);
      }
    }
  };

  const handleMockScan = () => {
    if (showScanModal || showTransferModal || isCoolingDown || isSyncing) return;
    const randomMock = MOCK_SCAN_DATA[Math.floor(Math.random() * MOCK_SCAN_DATA.length)];
    const mockMgmtNo = randomMock.mgmt;
    setScannedResult(mockMgmtNo);
    let match = masterData.find(row => String(row[MASTER_COLUMNS.MGMT_NO] || "").trim() === mockMgmtNo);
    if (!match) {
      const tempRow: MasterDataRow = { [MASTER_COLUMNS.MGMT_NO]: randomMock.mgmt, [MASTER_COLUMNS.ASSET_NO]: randomMock.asset, [MASTER_COLUMNS.PROD_NO]: randomMock.code, [MASTER_COLUMNS.PROD_NAME]: randomMock.name, [MASTER_COLUMNS.MANUFACTURER]: randomMock.brand, [MASTER_COLUMNS.MODEL_NAME]: randomMock.model, [MASTER_COLUMNS.PROD_YEAR]: randomMock.year, [MASTER_COLUMNS.SERIAL_NO]: randomMock.serial, [AUDIT_COLUMNS.STATUS]: '' };
      setMasterData(prev => [tempRow, ...prev]);
      match = tempRow;
    }
    setFoundRow(match);
    setShowScanModal(true);
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) html5QrCodeRef.current.pause();
  };

  const confirmAudit = () => {
    if (!foundRow) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    setMasterData(prev => prev.map(row => {
      if (row[MASTER_COLUMNS.MGMT_NO] === foundRow[MASTER_COLUMNS.MGMT_NO]) {
        return { ...row, [AUDIT_COLUMNS.DATE]: dateStr, [AUDIT_COLUMNS.STATUS]: 'O' };
      }
      return row;
    }));
    closeScanModal();
  };

  const closeScanModal = () => {
    setShowScanModal(false);
    setScannedResult(null);
    setFoundRow(null);
    setIsCoolingDown(true);
    setTimeout(() => {
      setIsCoolingDown(false);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        try {
          html5QrCodeRef.current.resume();
          console.log("Scanner resumed");
        } catch (e) {
          console.error("Error resuming scanner:", e);
          // 재개 실패 시 스캐너 재시작
          startScanner();
        }
      } else if (html5QrCodeRef.current && !html5QrCodeRef.current.isScanning) {
        // 스캐너가 멈춰있으면 재시작
        startScanner();
      }
    }, 1500);
  };

  const handleOpenTransferModal = () => {
    if (auditHistory.length === 0) { alert("전송할 실사 데이터가 없습니다."); return; }
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedCenter.trim() || !selectedZone.trim()) { alert("센터 및 구역 위치를 모두 입력해 주세요."); return; }
    setIsSyncing(true);
    try {
      const result = await syncAuditDataToCloud(serviceUrl, masterData, selectedSheet, selectedCenter, selectedZone);
      setLastSyncTime(new Date().toLocaleTimeString());
      setMasterData(prev => prev.map(row => {
        if (row[AUDIT_COLUMNS.STATUS] === 'O') {
          return { ...row, [AUDIT_COLUMNS.STATUS]: '', [AUDIT_COLUMNS.CENTER]: selectedCenter, [AUDIT_COLUMNS.ZONE]: selectedZone };
        }
        return row;
      }));
      alert(`${result.count}건의 실사 결과가 전송되었습니다.`);
      setShowTransferModal(false);
    } catch (error) {
      alert("데이터 전송 중 오류가 발생했습니다.");
    } finally { setIsSyncing(false); }
  };

  const handleCenterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") { setIsCustomCenter(true); setSelectedCenter(""); setSelectedZone(""); }
    else { setIsCustomCenter(false); setSelectedCenter(val); setSelectedZone(""); }
  };

  const handleZoneSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") { setIsCustomZone(true); setSelectedZone(""); }
    else { setIsCustomZone(false); setSelectedZone(val); }
  };

  // 선택된 센터의 구역 리스트를 안전하게 가져오기
  const zonesFromMapping = selectedCenter ? locationMapping[selectedCenter] : [];
  const availableZones = Array.isArray(zonesFromMapping) ? zonesFromMapping : [];

  // 센터 옵션: numeric 옵션으로 1, 2, 10 순서 정렬
  const centerOptions = Object.keys(locationMapping)
    .filter(k => k && k !== "undefined" && k !== "null")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2.5 rounded-xl text-white shadow-lg shadow-purple-100"><ScanQrCode className="w-6 h-6" /></div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">현장 자산 실사</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded">시트: {selectedSheet || "기본"}</span>
              <a href={SHARED_SHEET_URL} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded transition-colors hidden">
                <ExternalLink className="w-3 h-3 " /> 공유 시트 보기</a>
              {lastSyncTime && <p className="text-[10px] text-green-600 font-black flex items-center gap-1"><Check className="w-3 h-3" /> 마지막 전송: {lastSyncTime}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden ring-1 ring-gray-100">
            <div className="p-5 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <div className={`w-2 h-2 rounded-full ${cameraStatus === 'ready' ? (isCoolingDown ? 'bg-amber-500 animate-pulse' : 'bg-green-500') : 'bg-red-500'}`}></div>{cameraStatus === 'ready' ? '스캔 중...' : '스캔 준비 중...'}
                </span>
              </div>
              <button onClick={startScanner} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 flex items-center gap-1 text-xs font-bold"><RefreshCcw className="w-4 h-4" /> 리셋</button>
            </div>
            <div className="p-4 bg-black min-h-[400px] flex items-center justify-center relative">
              <div id={scannerId} className="w-full h-full min-h-[400px] overflow-hidden rounded-2xl"></div>
              {cameraStatus === 'error' && (
                <div className="absolute inset-0 z-10 bg-gray-900 flex flex-col items-center justify-center text-white p-6 sm:p-8 text-center">
                  <CameraOff className="w-16 h-16 text-red-500 mb-6 opacity-50" /><p className="font-bold text-lg mb-2">카메라 연결 불가</p><p className="text-xs text-gray-400 mb-6 leading-relaxed">{errorMessage}</p>
                </div>
              )}
              {cameraStatus === 'loading' && (
                <div className="absolute inset-0 z-10 bg-gray-900/50 flex flex-col items-center justify-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm font-bold">카메라 초기화 중...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-2xl border border-gray-100 h-full min-h-[500px] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><History className="w-5 h-5 text-purple-600" /> 실사 대기 목록</h3>
            <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-[11px] font-black shadow-md shadow-purple-100">{auditHistory.length} 건</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar mb-6 max-h-[350px]">
            {auditHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20 opacity-40"><Package className="w-16 h-16 mb-4" /><p className="text-sm font-bold">스캔된 항목이 없습니다</p></div>
            ) : (
              auditHistory.map((row, idx) => (
                <div key={`${row[MASTER_COLUMNS.MGMT_NO]}-${idx}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:bg-white hover:shadow-xl group">
                  <div className="flex items-center gap-4"><div className="bg-white p-2.5 rounded-xl shadow-sm group-hover:bg-purple-600 group-hover:text-white transition-all"><Package className="w-5 h-5" /></div><div><p className="text-sm font-black text-gray-900">{row[MASTER_COLUMNS.MGMT_NO]}</p><p className="text-[11px] text-gray-500 truncate max-w-[150px] font-medium">{row[MASTER_COLUMNS.PROD_NAME] || '정보 없음'}</p></div></div>
                  <div className="text-right"><p className="text-xs font-black text-purple-700">{row[AUDIT_COLUMNS.DATE]}</p></div>
                </div>
              ))
            )}
          </div>
          <button type="button" onClick={handleOpenTransferModal} disabled={auditHistory.length === 0 || isSyncing} className={`w-full flex justify-center items-center gap-3 px-8 py-5 rounded-2xl font-black transition-all shadow-xl active:scale-95 ${auditHistory.length > 0 && !isSyncing ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200" : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"}`}>
            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudUpload className="w-6 h-6" />} {isSyncing ? "데이터 전송 중..." : "실사 결과 일괄 전송"}
          </button>
        </div>
      </div>

      {showScanModal && foundRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-400">
            <div className="bg-purple-600 p-6 sm:p-8 sm:p-10 text-white relative">
              <button onClick={closeScanModal} className="absolute top-8 right-8 p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              <h3 className="text-5xl font-black tracking-tighter leading-none">{foundRow[MASTER_COLUMNS.MGMT_NO]}</h3>
            </div>
            <div className="p-6 sm:p-8 sm:p-10 space-y-8">
              <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100"><span className="text-[10px] font-black text-gray-400 uppercase block mb-1 tracking-widest">상품 정보</span><p className="font-black text-gray-900 text-xl leading-tight">{foundRow[MASTER_COLUMNS.PROD_NAME] || '정보 없음'}</p></div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={closeScanModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black py-5 rounded-3xl transition-all">취소</button><button type="button" onClick={confirmAudit} className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white font-black py-5 rounded-3xl shadow-2xl shadow-purple-200 flex items-center justify-center gap-3 transition-all active:scale-95"><CheckCircle className="w-6 h-6" /> 실사 확인</button></div>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-400">
            <div className="bg-blue-600 p-6 sm:p-8 text-white relative">
              <button onClick={() => setShowTransferModal(false)} className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              <div className="flex items-center gap-3 mb-4"><div className="bg-white/20 p-2 rounded-xl"><MapPin className="w-6 h-6" /></div><h3 className="text-2xl font-black">실사 위치 선택</h3></div>
            </div>
            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Building className="w-3 h-3 text-blue-500" /> 센터 정보</label>
                  {!isCustomCenter ? (
                    <div className="relative group">
                      <select value={selectedCenter} onChange={handleCenterSelect} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-black text-gray-900 outline-none focus:ring-4 focus:ring-blue-100 transition-all appearance-none cursor-pointer">
                        <option value="">센터를 선택하세요</option>
                        {centerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        <option value="custom">+ 직접 입력하기</option>
                      </select>
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-gray-400"><Plus className="w-4 h-4" /></div>
                    </div>
                  ) : (
                    <div className="flex gap-2 animate-in slide-in-from-right-2"><input type="text" autoFocus value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)} placeholder="직접 입력" className="flex-1 bg-white border-2 border-blue-200 rounded-2xl px-5 py-4 font-black text-gray-900 outline-none shadow-lg shadow-blue-50" /><button onClick={() => { setIsCustomCenter(false); setSelectedCenter(""); setSelectedZone(""); }} className="p-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200"><RefreshCcw className="w-5 h-5" /></button></div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Navigation className="w-3 h-3 text-purple-500" /> 세부 구역 정보</label>
                  {!isCustomZone ? (
                    <div className="relative group">
                      <select value={selectedZone} disabled={!selectedCenter && !isCustomCenter} onChange={handleZoneSelect} className={`w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-black text-gray-900 outline-none focus:ring-4 focus:ring-purple-100 transition-all appearance-none cursor-pointer ${(!selectedCenter && !isCustomCenter) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <option value="">{!selectedCenter ? "먼저 센터를 선택하세요" : "구역을 선택하세요"}</option>
                        {availableZones.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        {(selectedCenter || isCustomCenter) && <option value="custom">+ 직접 입력하기</option>}
                      </select>
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-gray-400"><Plus className="w-4 h-4" /></div>
                    </div>
                  ) : (
                    <div className="flex gap-2 animate-in slide-in-from-right-2"><input type="text" autoFocus value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)} placeholder="직접 입력" className="flex-1 bg-white border-2 border-purple-200 rounded-2xl px-5 py-4 font-black text-gray-900 outline-none shadow-lg shadow-purple-50" /><button onClick={() => { setIsCustomZone(false); setSelectedZone(""); }} className="p-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200"><RefreshCcw className="w-5 h-5" /></button></div>
                  )}
                </div>
              </div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black py-4 rounded-2xl transition-all">취소</button><button type="button" onClick={handleConfirmTransfer} disabled={isSyncing || !selectedCenter || !selectedZone} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-gray-300">저장하기</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountAuditPage;
