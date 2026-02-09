
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import { MasterDataRow, ChecklistData, CHECKLIST_COLUMNS, MASTER_COLUMNS } from "../types";

/**
 * 기본 구글 앱스 스크립트 배포 URL
 * 환경 변수에서 가져오거나 기본값 사용
 */
export const AUDIT_GAS_URL = (import.meta.env?.VITE_AUDIT_GAS_URL as string) || "https://script.google.com/macros/s/AKfycbzMoin5Oaj1xzIpjjJ9C66Mc7DDgR0f0KErzlNqPC-VTInE8q66RRtA5p_EJGDabfg9/exec";

/** URL에 쿼리 구분자(? 또는 &) 붙이기 */
function getUrlSeparator(url: string): string {
  return url.includes("?") ? "&" : "?";
}

/**
 * 시트 목록 조회
 */
export const fetchSheetList = async (url: string): Promise<string[]> => {
  try {
    const separator = getUrlSeparator(url);
    const fetchUrl = `${url}${separator}action=listSheets&t=${Date.now()}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const sheets = await response.json();
    return Array.isArray(sheets) ? sheets.filter(name => name.includes('마스터파일')) : [];
  } catch (error) {
    console.error("Error fetching sheet list:", error);
    throw error;
  }
};

/**
 * 위치 옵션(센터 -> 구역 매핑) 조회
 */
export const fetchLocationOptions = async (url: string): Promise<Record<string, string[]>> => {
  try {
    const fetchUrl = `${url}${getUrlSeparator(url)}action=getLocationOptions&t=${Date.now()}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching location options:", error);
    return {};
  }
};

/**
 * 마스터 데이터(읽기전용) 가져오기
 */
export const fetchMasterFromCloud = async (url: string, sheetName?: string): Promise<MasterDataRow[]> => {
  try {
    const sheetParam = sheetName ? `&sheetName=${encodeURIComponent(sheetName)}` : "";
    const fetchUrl = `${url}${getUrlSeparator(url)}action=read${sheetParam}&t=${Date.now()}`;
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json() as MasterDataRow[];
  } catch (error) {
    console.error("Error fetching master from cloud:", error);
    throw error;
  }
};

/**
 * 로컬 엑셀 파일 파싱
 */
export const parseMasterExcel = (file: File): Promise<MasterDataRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        resolve(XLSX.utils.sheet_to_json<MasterDataRow>(worksheet));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 체크리스트 생성/업데이트 (Upsert)
 */
export const syncChecklistToCloud = async (url: string, data: ChecklistData[], _unused?: string): Promise<{ success: boolean; count: number }> => {
  if (data.length === 0) return { success: false, count: 0 };

  const rows = data.map((item) => {
    const assetNumber = String(item.assetNumber || "").trim();
    const isAbnormalAsset = !assetNumber || assetNumber === "" || assetNumber === "null";
    
    return {
      [CHECKLIST_COLUMNS.MGMT_NO]: String(item.mgmtNumber || "").trim(),
      [CHECKLIST_COLUMNS.ASSET_NO]: assetNumber,
      [CHECKLIST_COLUMNS.PROD_CODE]: String(item.productCode || "").trim(),
      [CHECKLIST_COLUMNS.PROD_NAME]: String(item.productName || "").trim(),
      [CHECKLIST_COLUMNS.MANUFACTURER]: String(item.manufacturer || "").trim(),
      [CHECKLIST_COLUMNS.MODEL]: String(item.model || "").trim(),
      [CHECKLIST_COLUMNS.YEAR]: String(item.year || "").trim(),
      [CHECKLIST_COLUMNS.VEHICLE_NO]: String(item.vehicleNumber || "").trim(),
      [CHECKLIST_COLUMNS.SERIAL_NO]: String(item.serialNumber || "").trim(),
      ...(isAbnormalAsset && { [CHECKLIST_COLUMNS.ABNORMAL_ASSET]: 'O' }),
    };
  });

  const payload = {
    action: "checklist",
    rows: rows
  };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    return { success: true, count: rows.length };
  } catch (error) {
    console.error("Checklist Sync error:", error);
    throw error;
  }
};

/**
 * 자산 실사 데이터 업데이트 (Upsert)
 */
export const syncAuditDataToCloud = async (
  url: string,
  data: MasterDataRow[],
  // selectedSheet(레거시): 호출부 호환성을 위해 남겨두되 사용하지 않음
  _unused?: string,
  centerLocation?: string,
  assetLocation?: string,
  auditorName?: string
): Promise<{ success: boolean; count: number }> => {
  const auditedItems = data.filter(row => row[CHECKLIST_COLUMNS.AUDIT_STATUS] === 'O' || row['자산실사 여부'] === 'O');
  if (auditedItems.length === 0) return { success: false, count: 0 };

  const payload = {
    action: "audit",
    rows: auditedItems.map((row) => {
      const assetNumber = String(row[MASTER_COLUMNS.ASSET_NO] || row[CHECKLIST_COLUMNS.ASSET_NO] || "").trim();
      const isAbnormalAsset = !assetNumber || assetNumber === "" || assetNumber === "null";
      
      // 자산실사자 값 확인 및 로깅
      const auditUserValue = auditorName || "";
      if (!auditUserValue) {
        console.warn("자산실사자 정보가 없습니다. 현재 로그인 사용자 정보를 확인해주세요.");
      }
      
      return {
        [CHECKLIST_COLUMNS.MGMT_NO]: String(row[MASTER_COLUMNS.MGMT_NO] || row[CHECKLIST_COLUMNS.MGMT_NO] || "").trim(),
        [CHECKLIST_COLUMNS.AUDIT_DATE]: row[CHECKLIST_COLUMNS.AUDIT_DATE] || row['자산실사일'] || new Date().toLocaleDateString(),
        [CHECKLIST_COLUMNS.AUDIT_STATUS]: "O",
        [CHECKLIST_COLUMNS.CENTER_LOC]: centerLocation || "",
        [CHECKLIST_COLUMNS.ASSET_LOC]: assetLocation || "",
        [CHECKLIST_COLUMNS.AUDIT_USER]: auditUserValue, // '자산실사자' 키로 전송
        ...(isAbnormalAsset && { [CHECKLIST_COLUMNS.ABNORMAL_ASSET]: 'O' }),
      };
    })
  };
  
  // 디버깅 로그는 개발 모드에서만
  if (import.meta.env.DEV) {
    console.log("전송할 자산실사자 정보:", auditorName);
    console.log("전송할 데이터 샘플:", payload.rows[0]);
  }

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    return { success: true, count: payload.rows.length };
  } catch (error) {
    console.error("Audit Sync error:", error);
    throw error;
  }
};

export const exportMasterWithImages = async (data: MasterDataRow[], fileName: string = "master_with_qr.xlsx") => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Asset List");
  sheet.columns = [
    { header: "QR", key: "qr", width: 15 },
    { header: "관리번호", key: "mgmt", width: 20 },
    { header: "자산번호", key: "asset", width: 20 },
    { header: "상품코드", key: "prodCode", width: 20 },
    { header: "상품명", key: "prodName", width: 40 },
    { header: "제조사", key: "brand", width: 20 },
    { header: "모델", key: "model", width: 20 },
    { header: "년식", key: "year", width: 10 },
    { header: "자산실사일", key: "auditDate", width: 15 },
    { header: "실사여부", key: "auditStatus", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  for (let i = 0; i < data.length; i++) {
    const rowData = data[i];
    const mgmtNo = String(rowData[MASTER_COLUMNS.MGMT_NO] || rowData[CHECKLIST_COLUMNS.MGMT_NO] || "").trim();
    const currentRow = i + 2;
    sheet.getRow(currentRow).height = 80;
    sheet.addRow({
      mgmt: mgmtNo,
      asset: rowData[MASTER_COLUMNS.ASSET_NO] || rowData[CHECKLIST_COLUMNS.ASSET_NO],
      prodCode: rowData[MASTER_COLUMNS.PROD_NO] || rowData[CHECKLIST_COLUMNS.PROD_CODE],
      prodName: rowData[MASTER_COLUMNS.PROD_NAME] || rowData[CHECKLIST_COLUMNS.PROD_NAME],
      brand: rowData[MASTER_COLUMNS.MANUFACTURER] || rowData[CHECKLIST_COLUMNS.MANUFACTURER],
      model: rowData[MASTER_COLUMNS.MODEL_NAME] || rowData[CHECKLIST_COLUMNS.MODEL],
      year: rowData[MASTER_COLUMNS.PROD_YEAR] || rowData[CHECKLIST_COLUMNS.YEAR],
      auditDate: rowData[CHECKLIST_COLUMNS.AUDIT_DATE],
      auditStatus: rowData[CHECKLIST_COLUMNS.AUDIT_STATUS],
    });
    if (mgmtNo) {
      try {
        const qrBase64 = await QRCode.toDataURL(mgmtNo, { margin: 1, width: 200 });
        const imageId = workbook.addImage({ base64: qrBase64, extension: 'png' });
        sheet.addImage(imageId, { tl: { col: 2.1, row: i + 1.1 }, ext: { width: 100, height: 100 } });
      } catch (err) { }
    }
    sheet.getRow(currentRow).alignment = { vertical: 'middle', horizontal: 'center' };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
};

export const downloadChecklistExcel = async (dataList: ChecklistData[], engineerInput: string, fileName: string = "checklists.xlsx") => {
  const workbook = new ExcelJS.Workbook();
  const ITEMS_PER_SHEET = 3;
  const ROWS_PER_BLOCK = 15; // 각 체크리스트 블록의 행 수 증가

  // 스타일 정의
  const thickBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thick" },
    left: { style: "thick" },
    bottom: { style: "thick" },
    right: { style: "thick" }
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  const headerStyle: Partial<ExcelJS.Style> = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } },
    font: { bold: true, size: 12, name: "Malgun Gothic" },
    alignment: { horizontal: "center", vertical: "middle" },
    border: thickBorder
  };
  const valueStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 12, name: "Malgun Gothic" },
    alignment: { horizontal: "center", vertical: "middle" },
    border: thickBorder
  };
  const valueStyleLeft: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 12, name: "Malgun Gothic" },
    alignment: { horizontal: "left", vertical: "middle" },
    border: thickBorder
  };

  for (let i = 0; i < dataList.length; i += ITEMS_PER_SHEET) {
    const chunk = dataList.slice(i, i + ITEMS_PER_SHEET);
    const sheet = workbook.addWorksheet(`Page ${Math.floor(i / ITEMS_PER_SHEET) + 1}`);

    // 컬럼 너비 설정 (8개 컬럼)
    sheet.columns = [
      { width: 12 }, // A: 상품코드, 제조사, 자산번호
      { width: 20 }, // B: 값들
      { width: 12 }, // C: 상품명, 모델, 차량번호
      { width: 20 }, // D: 값들
      { width: 12 }, // E: 년식, 차대번호
      { width: 20 }, // F: 값들
      { width: 17 }, // G: 사용시간
      { width: 20 }  // H: 값들, QR 코드 영역
    ];

    for (let j = 0; j < chunk.length; j++) {
      const data = chunk[j];
      const startRow = (j * ROWS_PER_BLOCK) + 1;
      const today = new Date();
      const yyyy = today.getFullYear().toString();

      // === Row 1: 제목 및 관리번호 ===
      sheet.getRow(startRow).height = 120;

      /*      // 모든 셀에 border 설정 (병합 전)
           for (let col = 4; col <= 8; col++) {
             const cell = sheet.getCell(startRow, col);
             cell.border = thickBorder;
           } */

      // 제목 (A1:E1 병합)
      sheet.mergeCells(`A${startRow}:E${startRow}`);
      sheet.getCell(`A${startRow}`).value = "상품/임가/경,중 체크리스트";
      sheet.getCell(`A${startRow}`).font = { bold: true, size: 20, name: "Malgun Gothic" };
      sheet.getCell(`A${startRow}`).alignment = { horizontal: "left", vertical: "middle" };
      // sheet.getCell(`A${startRow}`).border = thickBorder;

      // 관리번호 (F1:G1 병합)
      sheet.mergeCells(`F${startRow}:G${startRow}`);
      sheet.getCell(`F${startRow}`).value = "관리번호:";
      sheet.getCell(`F${startRow}`).font = { bold: true, size: 12, name: "Malgun Gothic" };
      sheet.getCell(`F${startRow}`).alignment = { horizontal: "right", vertical: "middle" };
      // sheet.getCell(`F${startRow}`).border = thickBorder;

      // 관리번호 값 (H1)
      sheet.getCell(`H${startRow}`).value = data.mgmtNumber;
      sheet.getCell(`H${startRow}`).font = { bold: true, size: 14, name: "Malgun Gothic" };
      sheet.getCell(`H${startRow}`).alignment = { horizontal: "center", vertical: "middle" };
      // sheet.getCell(`H${startRow}`).border = thickBorder;

      // QR 코드 이미지 추가
      try {
        const qr = await QRCode.toDataURL(data.mgmtNumber, { margin: 1, width: 200 });
        const imgId = workbook.addImage({ base64: qr, extension: "png" });
        sheet.addImage(imgId, {
          tl: { col: 7.9, row: startRow - 0.2 },
          ext: { width: 90, height: 90 }
        });
      } catch (err) {
        console.error("QR 생성 오류:", err);
      }

      // === Row 2: 빈 행 (간격) ===
      sheet.getRow(startRow + 1).height = 20;

      // === Row 3: 정비 정보 ===
      sheet.getRow(startRow + 2).height = 120;
      const maintenanceRow = startRow + 2;

      /*    // 모든 셀에 border 설정
         for (let col = 5; col <= 8; col++) {
           const cell = sheet.getCell(maintenanceRow, col);
           cell.border = thickBorder;
         } */

      // 정비 일자
      sheet.getCell(`A${maintenanceRow}`).value = `정비 일자: ${yyyy}.`;
      sheet.getCell(`A${maintenanceRow}`).font = { bold: true, size: 12, name: "Malgun Gothic" };
      sheet.getCell(`A${maintenanceRow}`).alignment = { horizontal: "left", vertical: "middle" };
      // sheet.getCell(`A${maintenanceRow}`).border = thickBorder;

      // 정비자
      sheet.getCell(`C${maintenanceRow}`).value = `정비자: ${engineerInput}`;
      sheet.getCell(`C${maintenanceRow}`).font = { bold: true, size: 12, name: "Malgun Gothic" };
      sheet.getCell(`C${maintenanceRow}`).alignment = { horizontal: "left", vertical: "middle" };
      // sheet.getCell(`B${maintenanceRow}`).border = thickBorder;

      // QC 일자
      sheet.getCell(`E${maintenanceRow}`).value = `QC 일자: ${yyyy}.`;
      sheet.getCell(`E${maintenanceRow}`).font = { bold: true, size: 12, name: "Malgun Gothic" };
      sheet.getCell(`E${maintenanceRow}`).alignment = { horizontal: "left", vertical: "middle" };
      // sheet.getCell(`C${maintenanceRow}`).border = thickBorder;

      // QC
      sheet.getCell(`G${maintenanceRow}`).value = "QC:";
      sheet.getCell(`G${maintenanceRow}`).font = { bold: true, size: 12, name: "Malgun Gothic" };
      sheet.getCell(`G${maintenanceRow}`).alignment = { horizontal: "left", vertical: "middle" };
      // sheet.getCell(`D${maintenanceRow}`).border = thickBorder;

      /* // E-H 셀도 border 설정
      for (let col = 5; col <= 8; col++) {
        sheet.getCell(maintenanceRow, col).border = thickBorder;
      } */

      // === Row 4: 빈 행 ===
      sheet.getRow(startRow + 3).height = 20;

      // === Row 5: 상품코드 및 상품명 ===
      sheet.getRow(startRow + 4).height = 90;
      const productRow = startRow + 4;

      // 상품코드 헤더
      sheet.getCell(`A${productRow}`).value = "상품코드";
      sheet.getCell(`A${productRow}`).style = headerStyle;

      // 상품코드 값
      sheet.getCell(`B${productRow}`).value = data.productCode || "";
      sheet.getCell(`B${productRow}`).style = valueStyle;

      // 상품명 헤더
      sheet.getCell(`C${productRow}`).value = "상품명";
      sheet.getCell(`C${productRow}`).style = headerStyle;

      // 상품명 값 (D5:H5 병합) - 병합 전에 모든 셀에 border 설정
      for (let col = 4; col <= 8; col++) {
        sheet.getCell(productRow, col).border = thickBorder;
      }
      sheet.mergeCells(`D${productRow}:H${productRow}`);
      sheet.getCell(`D${productRow}`).value = data.productName || "";
      sheet.getCell(`D${productRow}`).style = valueStyleLeft;
      sheet.getCell(`D${productRow}`).border = thickBorder;

      // === Row 6: 제조사, 모델, 년식, 사용시간 ===
      sheet.getRow(startRow + 5).height = 90;
      const specRow = startRow + 5;
      sheet.getCell(`B${specRow}`).style = valueStyle;

      // 제조사
      sheet.getCell(`A${specRow}`).value = "제조사";
      sheet.getCell(`A${specRow}`).style = headerStyle;
      sheet.getCell(`B${specRow}`).value = data.manufacturer || "";
      sheet.getCell(`B${specRow}`).style = valueStyle;

      // 모델
      sheet.getCell(`C${specRow}`).value = "모델";
      sheet.getCell(`C${specRow}`).style = headerStyle;
      sheet.getCell(`D${specRow}`).value = data.model || "";
      sheet.getCell(`D${specRow}`).style = valueStyle;

      // 년식
      sheet.getCell(`E${specRow}`).value = "년식";
      sheet.getCell(`E${specRow}`).style = headerStyle;
      sheet.getCell(`F${specRow}`).value = data.year || "";
      sheet.getCell(`F${specRow}`).style = valueStyle;

      // 사용시간
      sheet.getCell(`G${specRow}`).value = "사용시간";
      sheet.getCell(`G${specRow}`).style = headerStyle;
      sheet.getCell(`H${specRow}`).value = data.usageTime || "";
      sheet.getCell(`H${specRow}`).style = valueStyle;

      // === Row 7: 자산번호, 차량번호, 차대번호 ===
      sheet.getRow(startRow + 6).height = 90;
      const assetRow = startRow + 6;

      // 자산번호
      sheet.getCell(`A${assetRow}`).value = "자산번호";
      sheet.getCell(`A${assetRow}`).style = headerStyle;
      sheet.getCell(`B${assetRow}`).value = data.assetNumber || "";
      sheet.getCell(`B${assetRow}`).style = valueStyle;

      // 차량번호
      sheet.getCell(`C${assetRow}`).value = "차량번호";
      sheet.getCell(`C${assetRow}`).style = headerStyle;
      sheet.getCell(`D${assetRow}`).value = data.vehicleNumber || "";
      sheet.getCell(`D${assetRow}`).style = valueStyle;

      // 차대번호
      sheet.getCell(`E${assetRow}`).value = "차대번호";
      sheet.getCell(`E${assetRow}`).style = headerStyle;
      // 차대번호 값 (F7:H7 병합) - 병합 전에 모든 셀에 border 설정
      for (let col = 6; col <= 8; col++) {
        sheet.getCell(assetRow, col).border = thickBorder;
      }
      sheet.mergeCells(`F${assetRow}:H${assetRow}`);
      sheet.getCell(`F${assetRow}`).value = data.serialNumber || "";
      sheet.getCell(`F${assetRow}`).style = valueStyleLeft;
      sheet.getCell(`F${assetRow}`).border = thickBorder;

      // === Row 8: 빈 행 ===
      sheet.getRow(startRow + 7).height = 20;

      // === Row 9: 물류/건설 및 범례 ===
      sheet.getRow(startRow + 8).height = 80;
      const footerRow = startRow + 8;
      /*  
       // 모든 셀에 border 설정 (병합 전)
       for (let col = 1; col <= 8; col++) {
         sheet.getCell(footerRow, col).border = thickBorder;
       } */

      // 물류
      sheet.getCell(`A${footerRow}`).value = "물류:";
      sheet.getCell(`A${footerRow}`).font = { bold: true, size: 14, name: "Malgun Gothic" };
      sheet.getCell(`A${footerRow}`).alignment = { horizontal: "left", vertical: "middle" };
      // sheet.getCell(`A${footerRow}`).border = thickBorder;
      sheet.getCell(`B${footerRow}`).value = data.category === "물류" ? "O" : "";
      sheet.getCell(`B${footerRow}`).font = { bold: true, size: 18, name: "Malgun Gothic" };
      sheet.getCell(`B${footerRow}`).alignment = { horizontal: "center", vertical: "middle" };
      // sheet.getCell(`B${footerRow}`).border = thickBorder;

      // 건설
      sheet.getCell(`C${footerRow}`).value = "건설:";
      sheet.getCell(`C${footerRow}`).font = { bold: true, size: 14, name: "Malgun Gothic" };
      sheet.getCell(`C${footerRow}`).alignment = { horizontal: "left", vertical: "middle" };
      // sheet.getCell(`C${footerRow}`).border = thickBorder;
      sheet.getCell(`D${footerRow}`).value = data.category === "건설" ? "O" : "";
      sheet.getCell(`D${footerRow}`).font = { bold: true, size: 18, name: "Malgun Gothic" };
      sheet.getCell(`D${footerRow}`).alignment = { horizontal: "center", vertical: "middle" };
      // sheet.getCell(`D${footerRow}`).border = thickBorder;

      // 범례 (E9:H9 병합)
      sheet.mergeCells(`E${footerRow}:H${footerRow}`);
      sheet.getCell(`E${footerRow}`).value = "양호: V   보통: △   불량: x   교체: O   해당없음: N";
      sheet.getCell(`E${footerRow}`).font = { bold: true, size: 11, name: "Malgun Gothic" };
      sheet.getCell(`E${footerRow}`).alignment = { horizontal: "right", vertical: "middle" };
      // sheet.getCell(`E${footerRow}`).border = thickBorder;

      // === Row 10-15: 빈 행 (간격) ===
      for (let k = 9; k < 15; k++) {
        sheet.getRow(startRow + k).height = 20;
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};
