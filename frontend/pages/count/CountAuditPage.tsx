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
  Beaker,
} from "lucide-react";
import {
  MasterDataRow,
  MASTER_COLUMNS,
  AUDIT_COLUMNS,
  CHECKLIST_COLUMNS,
} from "../../types";
import {
  syncAuditDataToCloud,
  fetchLocationOptions,
} from "../../services/excelService";
import { getCurrentUser } from "../../utils/orderingAuth";
import Header from "@/components/Header";
import Button from "@/components/Button";

interface CountAuditPageProps {
  masterData: MasterDataRow[];
  setMasterData: React.Dispatch<React.SetStateAction<MasterDataRow[]>>;
  serviceUrl: string;
  selectedSheet?: string;
  isDataLoading?: boolean;
}

const MOCK_SCAN_DATA = [
  {
    mgmt: "CL25R101",
    asset: "81601812",
    code: "851BX458",
    name: "전동 입식 2.5톤 3단 6500",
    brand: "클라크",
    model: "CRX25",
    year: "2011",
    serial: "CRX205-1264-9659KF",
  },
  {
    mgmt: "CL25R103",
    asset: "81604289",
    code: "851BX160",
    name: "전동 입식 2.5톤 3단 7000",
    brand: "클라크",
    model: "CRX25FL",
    year: "2016",
    serial: "CRX205-0580-9957KF",
  },
  {
    mgmt: "TY10R102",
    asset: "81600882",
    code: "851BX166",
    name: "전동 입식 1톤 2단 3000",
    brand: "도요타",
    model: "7FBR10",
    year: "1900",
    serial: "7FBR10-11807",
  },
  {
    mgmt: "TY14R101",
    asset: "81600844",
    code: "851BX569",
    name: "전동 입식 1.4톤 2단 4000",
    brand: "도요타",
    model: "7FBR14",
    year: "2008",
    serial: "7FBR14-11284",
  },
  {
    mgmt: "TY15C104",
    asset: "81600881",
    code: "851BX135",
    name: "전동 삼륜형 1.5톤 2단 3000",
    brand: "도요타",
    model: "7FBE15",
    year: "1900",
    serial: "7FBE18-58507",
  },
  {
    mgmt: "TY15C107",
    asset: "81600895",
    code: "851BX273",
    name: "전동 좌식 1.5톤 2단 3000",
    brand: "도요타",
    model: "7FB15",
    year: "1900",
    serial: "7FB18-50926",
  },
  {
    mgmt: "TY15C109",
    asset: "81600897",
    code: "851BX341",
    name: "전동 좌식 1.5톤 2단 3000",
    brand: "도요타",
    model: "7FBL15",
    year: "2007",
    serial: "7FB18-17471",
  },
];

const CountAuditPage: React.FC<CountAuditPageProps> = ({
  masterData,
  setMasterData,
  serviceUrl,
  selectedSheet,
  isDataLoading = false,
}) => {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [foundRow, setFoundRow] = useState<MasterDataRow | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [auditHistory, setAuditHistory] = useState<MasterDataRow[]>([]);
  const [cameraStatus, setCameraStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // 계층형 위치 데이터 상태
  const [locationMapping, setLocationMapping] = useState<
    Record<string, string[]>
  >({});
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [isCustomCenter, setIsCustomCenter] = useState(false);
  const [isCustomZone, setIsCustomZone] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader-container";
  const SHARED_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1NXT2EBow1zWxmPsb7frN90e95qRH1mkY9DQUgCrsn2I/edit?usp=sharing";

  // 스캔 중복 방지를 위한 ref
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedMgmtNoRef = useRef<string>("");
  const SCAN_COOLDOWN_MS = 2000; // 2초 쿨다운

  useEffect(() => {
    const audited = masterData.filter(
      (row) => row[AUDIT_COLUMNS.STATUS] === "O",
    );
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
            const centerKey = Object.keys(row).find((k) => k.includes("센터"));
            const zoneKey = Object.keys(row).find(
              (k) => k.includes("구역") || k.includes("위치"),
            );

            if (centerKey && row[centerKey]) {
              const c = String(row[centerKey]).trim();
              const z = zoneKey ? String(row[zoneKey] || "").trim() : "";
              if (!c || c === "undefined" || c === "null" || c === "센터 구분")
                return;
              if (!mapping[c]) mapping[c] = [];
              if (
                z &&
                z !== "undefined" &&
                z !== "null" &&
                z !== "구역 구분" &&
                !mapping[c].includes(z)
              ) {
                mapping[c].push(z);
              }
            }
          });
        } else if (typeof rawData === "object" && rawData !== null) {
          // 서버가 이미 가공된 매핑 객체를 보낸 경우
          mapping = rawData;
        }

        // 각 구역 리스트 정렬
        Object.keys(mapping).forEach((k) => mapping[k].sort());
        setLocationMapping(mapping);
      } catch (err) {
        console.error("Failed to load location options:", err);
        setLocationMapping({});
      }
    };
    loadOptions();
  }, [serviceUrl]);

  const startScanner = async () => {
    // 이미 스캔 중이면 재시작하지 않음
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      return;
    }

    setCameraStatus("loading");
    setErrorMessage(null);

    // 기존 스캐너가 있으면 정지
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

    const config = {
      fps: 10,
      qrbox: { width: 300, height: 300 },
      aspectRatio: 1.0,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    };

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // 스캔 에러는 무시
        },
      );
      setCameraStatus("ready");
    } catch (err: any) {
      console.error("Camera start error:", err);
      setCameraStatus("error");

      // 모바일에서 구체적인 에러 메시지 표시
      let errorMsg = "카메라를 시작할 수 없습니다.";
      const errorName = err?.name || "";
      const errorMessage = err?.message || "";

      if (
        errorName === "NotAllowedError" ||
        errorMessage.includes("permission") ||
        errorMessage.includes("권한") ||
        errorMessage.includes("denied")
      ) {
        errorMsg =
          "카메라 권한이 거부되었습니다.\n\n브라우저 설정에서 카메라 권한을 허용해주세요.\n(주소창 왼쪽 자물쇠 아이콘 클릭)";
      } else if (
        errorName === "NotFoundError" ||
        errorMessage.includes("not found") ||
        errorMessage.includes("찾을 수 없")
      ) {
        errorMsg =
          "카메라를 찾을 수 없습니다.\n\n기기의 카메라가 정상적으로 작동하는지 확인해주세요.";
      } else if (
        errorName === "NotReadableError" ||
        errorMessage.includes("not readable") ||
        errorMessage.includes("사용 중")
      ) {
        errorMsg =
          "카메라에 접근할 수 없습니다.\n\n다른 앱에서 카메라를 사용 중일 수 있습니다.\n모든 앱을 닫고 다시 시도해주세요.";
      } else if (
        errorName === "OverconstrainedError" ||
        errorMessage.includes("constraint")
      ) {
        errorMsg =
          "카메라 설정 오류입니다.\n\n리셋 버튼을 눌러 다시 시도해주세요.";
      } else if (errorMessage) {
        errorMsg = `카메라 오류: ${errorMessage}`;
      } else {
        errorMsg =
          "카메라를 시작할 수 없습니다.\n\n리셋 버튼을 눌러 다시 시도하거나,\n페이지를 새로고침해주세요.";
      }
      setErrorMessage(errorMsg);
    }
  };

  // 리셋 버튼 핸들러
  const handleResetScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current = null;
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
    }
    // DOM 정리
    const scannerElement = document.getElementById(scannerId);
    if (scannerElement) {
      scannerElement.innerHTML = "";
    }
    // 재시작
    setTimeout(() => {
      startScanner();
    }, 300);
  };

  // 동기화가 완료된 후에만 카메라 시작
  useEffect(() => {
    // 동기화 중이 아니고, 컴포넌트가 마운트된 상태일 때만 카메라 시작
    if (!isDataLoading) {
      // 동기화 완료 후 약간의 지연을 두어 DOM이 완전히 렌더링된 후 카메라 시작
      const timer = setTimeout(() => {
        startScanner();
      }, 500);

      return () => {
        clearTimeout(timer);
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {});
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoading]);

  const handleScanSuccess = (decodedText: string) => {
    // 디버깅 로그는 개발 모드에서만
    if (import.meta.env.DEV) console.log("QR 스캔 감지됨:", decodedText);

    if (showScanModal || showTransferModal || isCoolingDown || isSyncing) {
      if (import.meta.env.DEV)
        console.log("스캔 무시됨 - 모달/쿨다운/동기화 중");
      return;
    }

    const trimmedText = decodedText.trim();
    if (!trimmedText) {
      if (import.meta.env.DEV) console.log("스캔된 텍스트가 비어있음");
      return;
    }

    // 스캔 중복 방지: 같은 관리번호가 2초 이내에 다시 스캔되면 무시
    const now = Date.now();
    const timeSinceLastScan = now - lastScanTimeRef.current;
    const isSameMgmtNo = trimmedText === lastScannedMgmtNoRef.current;

    if (timeSinceLastScan < SCAN_COOLDOWN_MS && isSameMgmtNo) {
      if (import.meta.env.DEV)
        console.log(
          `스캔 무시됨 - 중복 스캔 (${timeSinceLastScan}ms 전에 같은 관리번호 스캔됨)`,
        );
      return;
    }

    // 마지막 스캔 정보 업데이트
    lastScanTimeRef.current = now;
    lastScannedMgmtNoRef.current = trimmedText;

    setScannedResult(trimmedText);
    let match = masterData.find((row) => {
      const mgmtNo = String(row[MASTER_COLUMNS.MGMT_NO] || "").trim();
      const assetNo = String(row[MASTER_COLUMNS.ASSET_NO] || "").trim();
      return mgmtNo === trimmedText || assetNo === trimmedText;
    });

    // 이미 실사 완료된 항목인지 확인 (중복 방지)
    if (match) {
      const isAlreadyAudited =
        match[AUDIT_COLUMNS.STATUS] === "O" ||
        match[CHECKLIST_COLUMNS.AUDIT_STATUS] === "O";
      if (isAlreadyAudited) {
        if (import.meta.env.DEV)
          console.log("이미 실사 완료된 항목입니다:", trimmedText);
        return; // 모달을 열지 않고 종료
      }
    }

    // 마스터파일에 없는 관리번호인 경우 임시 row 생성 (이상자산구분 'O'으로 설정)
    if (!match) {
      const tempRow: MasterDataRow = {
        [MASTER_COLUMNS.MGMT_NO]: trimmedText,
        [MASTER_COLUMNS.ASSET_NO]: "", // 자산번호 없음
        [MASTER_COLUMNS.PROD_NAME]: "마스터파일에 없는 관리번호",
        [CHECKLIST_COLUMNS.ABNORMAL_ASSET]: "O", // 이상자산구분 'O' 설정
        [AUDIT_COLUMNS.STATUS]: "",
      };
      // masterData에 추가
      setMasterData((prev) => [tempRow, ...prev]);
      match = tempRow;
    }

    setFoundRow(match);
    setShowScanModal(true);
    // pause()를 사용하지 않고, 모달이 열려있으면 자동으로 스캔 무시됨
  };

  const handleMockScan = () => {
    if (showScanModal || showTransferModal || isCoolingDown || isSyncing)
      return;
    const randomMock =
      MOCK_SCAN_DATA[Math.floor(Math.random() * MOCK_SCAN_DATA.length)];
    const mockMgmtNo = randomMock.mgmt;
    setScannedResult(mockMgmtNo);
    let match = masterData.find(
      (row) => String(row[MASTER_COLUMNS.MGMT_NO] || "").trim() === mockMgmtNo,
    );
    if (!match) {
      const tempRow: MasterDataRow = {
        [MASTER_COLUMNS.MGMT_NO]: randomMock.mgmt,
        [MASTER_COLUMNS.ASSET_NO]: randomMock.asset,
        [MASTER_COLUMNS.PROD_NO]: randomMock.code,
        [MASTER_COLUMNS.PROD_NAME]: randomMock.name,
        [MASTER_COLUMNS.MANUFACTURER]: randomMock.brand,
        [MASTER_COLUMNS.MODEL_NAME]: randomMock.model,
        [MASTER_COLUMNS.PROD_YEAR]: randomMock.year,
        [MASTER_COLUMNS.SERIAL_NO]: randomMock.serial,
        [AUDIT_COLUMNS.STATUS]: "",
      };
      setMasterData((prev) => [tempRow, ...prev]);
      match = tempRow;
    }
    setFoundRow(match);
    setShowScanModal(true);
  };

  const confirmAudit = () => {
    if (!foundRow) return;

    // 이미 실사 완료된 항목인지 확인 (중복 방지)
    const mgmtNo = foundRow[MASTER_COLUMNS.MGMT_NO];
    const alreadyAudited = masterData.some(
      (row) =>
        row[MASTER_COLUMNS.MGMT_NO] === mgmtNo &&
        (row[AUDIT_COLUMNS.STATUS] === "O" ||
          row[CHECKLIST_COLUMNS.AUDIT_STATUS] === "O"),
    );

    if (alreadyAudited) {
      alert("이미 실사 완료된 항목입니다.");
      closeScanModal();
      return;
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

    setMasterData((prev) =>
      prev.map((row) => {
        if (row[MASTER_COLUMNS.MGMT_NO] === mgmtNo) {
          const assetNumber = String(row[MASTER_COLUMNS.ASSET_NO] || "").trim();
          const isAbnormalAsset =
            !assetNumber || assetNumber === "" || assetNumber === "null";
          const updatedRow = {
            ...row,
            [AUDIT_COLUMNS.DATE]: dateStr,
            [CHECKLIST_COLUMNS.AUDIT_DATE]: dateStr,
            [AUDIT_COLUMNS.STATUS]: "O",
            [CHECKLIST_COLUMNS.AUDIT_STATUS]: "O",
          };
          // 자산번호가 없으면 이상자산구분 'O' 설정
          if (isAbnormalAsset) {
            updatedRow[CHECKLIST_COLUMNS.ABNORMAL_ASSET] = "O";
          }
          return updatedRow;
        }
        return row;
      }),
    );
    closeScanModal();
  };

  const closeScanModal = () => {
    setShowScanModal(false);
    setScannedResult(null);
    setFoundRow(null);
    // 모달이 닫힐 때 스캔 기록 초기화 (같은 관리번호를 다시 스캔할 수 있도록)
    lastScannedMgmtNoRef.current = "";
    setIsCoolingDown(true);
    setTimeout(() => {
      setIsCoolingDown(false);
      // pause()를 사용하지 않으므로 resume()도 필요 없음
      // 스캐너는 계속 실행 중이며, 모달이 닫히면 자동으로 스캔 가능
    }, 1500);
  };

  const handleOpenTransferModal = () => {
    if (auditHistory.length === 0) {
      alert("전송할 실사 데이터가 없습니다.");
      return;
    }
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedCenter.trim() || !selectedZone.trim()) {
      alert("센터 및 구역 위치를 모두 입력해 주세요.");
      return;
    }
    setIsSyncing(true);
    try {
      const currentUser = getCurrentUser();
      const auditorName = currentUser?.name || "";
      const result = await syncAuditDataToCloud(
        serviceUrl,
        masterData,
        selectedSheet,
        selectedCenter,
        selectedZone,
        auditorName,
      );
      setLastSyncTime(
        new Date().toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      // setLastSyncTime(new Date().toLocaleTimeString());
      setMasterData((prev) =>
        prev.map((row) => {
          if (row[AUDIT_COLUMNS.STATUS] === "O") {
            return {
              ...row,
              [AUDIT_COLUMNS.STATUS]: "",
              [AUDIT_COLUMNS.CENTER]: selectedCenter,
              [AUDIT_COLUMNS.ZONE]: selectedZone,
            };
          }
          return row;
        }),
      );
      alert(`${result.count}건의 실사 결과가 전송되었습니다.`);
      setShowTransferModal(false);
    } catch (error) {
      alert("데이터 전송 중 오류가 발생했습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCenterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") {
      setIsCustomCenter(true);
      setSelectedCenter("");
      setSelectedZone("");
    } else {
      setIsCustomCenter(false);
      setSelectedCenter(val);
      setSelectedZone("");
    }
  };

  const handleZoneSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") {
      setIsCustomZone(true);
      setSelectedZone("");
    } else {
      setIsCustomZone(false);
      setSelectedZone(val);
    }
  };

  // 선택된 센터의 구역 리스트를 안전하게 가져오기
  const zonesFromMapping = selectedCenter
    ? locationMapping[selectedCenter]
    : [];
  const availableZones = Array.isArray(zonesFromMapping)
    ? zonesFromMapping
    : [];

  // 센터 옵션: numeric 옵션으로 1, 2, 10 순서 정렬
  const centerOptions = Object.keys(locationMapping)
    .filter((k) => k && k !== "undefined" && k !== "null")
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );

  const admin = getCurrentUser()?.role === "관리자";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 relative">
      {/* 헤더 */}
      <Header
        headerTitle="현장 자산 실사"
        headerSubTitle="장비 점검, 실사, QR생성"
        level={2}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden ring-1 ring-gray-100">
            <div className="flex flex-col">
              <div className="m-4 mb-2 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <div
                      className={`w-2 h-2 rounded-full ${cameraStatus === "ready" ? (isCoolingDown ? "bg-amber-500 animate-pulse" : "bg-green-500") : "bg-red-500"}`}
                    ></div>
                    {cameraStatus === "ready"
                      ? "스캔 중..."
                      : "스캔 준비 중..."}
                  </span>
                  {admin && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleMockScan}
                      disabled={
                        showScanModal ||
                        showTransferModal ||
                        isCoolingDown ||
                        isSyncing
                      }
                      className={`${
                        showScanModal ||
                        showTransferModal ||
                        isCoolingDown ||
                        isSyncing
                          ? "bg-gray-600 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200"
                      }`}
                    >
                      <ScanQrCode className="w-5 h-5" />
                      테스트 스캔 실행
                    </Button>
                  )}
                </div>
                <Button onClick={handleResetScanner} variant="icon" fullWidth>
                  <RefreshCcw className="w-4 h-4" /> 리셋
                </Button>
              </div>
              <div className="flex justify-start m-4 mt-0 text-center">
                <span className="text-[11px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  연결된 데이터베이스: {selectedSheet || "기본"}
                </span>
                <a
                  href={SHARED_SHEET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded transition-colors hidden"
                >
                  <ExternalLink className="w-3 h-3 " /> 공유 시트 보기
                </a>
                {lastSyncTime && (
                  <p className="text-[10px] text-green-600 font-black flex items-center gap-1">
                    <Check className="w-3 h-3" /> 마지막 전송: {lastSyncTime}
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 bg-black min-h-[400px] flex items-center justify-center relative">
              <div
                id={scannerId}
                className="w-full h-full min-h-[400px] overflow-hidden rounded-2xl"
              ></div>
              {cameraStatus === "error" && (
                <div className="absolute inset-0 z-10 bg-gray-900 flex flex-col items-center justify-center text-white p-6 sm:p-8 text-center">
                  <CameraOff className="w-16 h-16 text-red-500 mb-6 opacity-50" />
                  <p className="font-bold text-lg mb-2">카메라 연결 불가</p>
                  <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              )}
              {cameraStatus === "loading" && (
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
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" /> 실사 대기 목록
            </h3>
            <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-[11px] font-black shadow-md shadow-purple-100">
              {auditHistory.length} 건
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar mb-6 max-h-[350px]">
            {auditHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20 opacity-40">
                <Package className="w-16 h-16 mb-4" />
                <p className="text-sm font-bold">스캔된 항목이 없습니다</p>
              </div>
            ) : (
              auditHistory.map((row, idx) => (
                <div
                  key={`${row[MASTER_COLUMNS.MGMT_NO]}-${idx}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:bg-white hover:shadow-xl group"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2.5 rounded-xl shadow-sm group-hover:bg-purple-600 group-hover:text-white transition-all">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">
                        {row[MASTER_COLUMNS.MGMT_NO]}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate max-w-[150px] font-medium">
                        {row[MASTER_COLUMNS.PROD_NAME] || "정보 없음"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-purple-700">
                      {row[AUDIT_COLUMNS.DATE]}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button
            onClick={handleOpenTransferModal}
            variant="primary"
            fullWidth
            disabled={auditHistory.length === 0 || isSyncing}
            className={`${auditHistory.length > 0 && !isSyncing ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200" : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"}`}
          >
            {isSyncing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CloudUpload className="w-6 h-6" />
            )}{" "}
            {isSyncing ? "데이터 전송 중..." : "실사 결과 일괄 전송"}
          </Button>
        </div>
      </div>

      {showScanModal && foundRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-400">
            <div className="bg-purple-600 p-4 sm:p-8 text-white relative flex flex-row items-center justify-between w-full">
              <h3 data-class="modal-header" className="text-white">
                스캔 정보
              </h3>
              <Button onClick={closeScanModal} variant="icon">
                <X className="w-6 h-6 text-white" />
              </Button>
            </div>
            <div className="p-4 sm:p-8 space-y-8">
              <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100">
                <p className="text-3xl mb-4 font-bold text-purple-600 tracking-tighter leading-none">
                  {foundRow[MASTER_COLUMNS.MGMT_NO]}
                </p>
                <p className="font-semibold text-gray-900 text-lg leading-tight">
                  {foundRow[MASTER_COLUMNS.PROD_NAME] || "정보 없음"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={closeScanModal}
                  variant="gray"
                  fullWidth
                >
                  <X className="w-4 h-4" /> 취소
                </Button>
                <Button
                  type="button"
                  onClick={confirmAudit}
                  variant="primary"
                  fullWidth
                >
                  <CheckCircle className="w-4 h-4" /> 실사 확인
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-400">
            <div className="bg-blue-600 p-6 sm:p-8 text-white relative flex flex-row items-center justify-between w-full">
              <h3 data-class="modal-header" className="text-white">
                실사 위치 선택
              </h3>
              <Button
                onClick={() => setShowTransferModal(false)}
                variant="icon"
              >
                <X className="w-6 h-6 text-white" />
              </Button>
            </div>
            <div className="p-6 sm:p-8 space-y-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Building className="w-3 h-3 text-blue-500" /> 센터 정보
                  </label>
                  {!isCustomCenter ? (
                    <div className="relative group">
                      <select
                        value={selectedCenter}
                        onChange={handleCenterSelect}
                        classNam
                      >
                        <option value="">센터를 선택하세요</option>
                        {centerOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                        <option value="custom">+ 직접 입력하기</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2 animate-in slide-in-from-right-2">
                      <input
                        type="text"
                        autoFocus
                        value={selectedCenter}
                        onChange={(e) => setSelectedCenter(e.target.value)}
                        placeholder="직접 입력"
                      />
                      <Button
                        onClick={() => {
                          setIsCustomCenter(false);
                          setSelectedCenter("");
                          setSelectedZone("");
                        }}
                        variant="icon"
                        className="p-2 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200"
                      >
                        <RefreshCcw className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-purple-500" /> 세부 구역
                    정보
                  </label>
                  {!isCustomZone ? (
                    <div className="relative group">
                      <select
                        value={selectedZone}
                        disabled={!selectedCenter && !isCustomCenter}
                        onChange={handleZoneSelect}
                        className={`  ${!selectedCenter && !isCustomCenter ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <option value="">
                          {!selectedCenter
                            ? "먼저 센터를 선택하세요"
                            : "구역을 선택하세요"}
                        </option>
                        {availableZones.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                        {(selectedCenter || isCustomCenter) && (
                          <option value="custom">+ 직접 입력하기</option>
                        )}
                      </select>
                      {/* <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-gray-400"><Plus className="w-4 h-4" /></div> */}
                    </div>
                  ) : (
                    <div className="flex gap-2 animate-in slide-in-from-right-2">
                      <input
                        type="text"
                        autoFocus
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        placeholder="직접 입력"
                        className="flex-1 bg-white border-2 border-purple-200 rounded-2xl px-5 py-4 font-black text-gray-900 outline-none shadow-lg shadow-purple-50"
                      />
                      <Button
                        onClick={() => {
                          setIsCustomZone(false);
                          setSelectedZone("");
                        }}
                        variant="icon"
                      >
                        <RefreshCcw className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <Button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  variant="gray"
                  fullWidth
                >
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmTransfer}
                  disabled={isSyncing || !selectedCenter || !selectedZone}
                  variant="primary"
                  fullWidth
                >
                  {isSyncing ? "저장 중..." : "저장하기"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountAuditPage;
