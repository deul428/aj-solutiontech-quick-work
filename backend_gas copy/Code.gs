
/**
 * AJ솔루션테크 - 통합 데이터 관리 스크립트
 */

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 체크리스트 데이터 조회 (관리자 전용)
  if (action === 'getChecklistData') {
    return getChecklistData(e.parameter);
  }

  // 계층형 위치 옵션 가져오기 (센터 -> 구역 매핑)
  if (action === 'getLocationOptions') {
    const sheet = ss.getSheetByName("자산위치_데이터");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({})).setMimeType(ContentService.MimeType.JSON);
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return ContentService.createTextOutput(JSON.stringify({})).setMimeType(ContentService.MimeType.JSON);
    
    const headers = data[0].map(h => String(h).trim());
    
    // 헤더 명칭 정밀 매칭: "센터"와 "구분"이 포함된 것 우선, 없으면 "센터" 포함된 것
    let centerIdx = headers.findIndex(h => h.includes("센터") && h.includes("구분"));
    if (centerIdx === -1) centerIdx = headers.findIndex(h => h.includes("센터"));
    
    let zoneIdx = headers.findIndex(h => h.includes("구역") && h.includes("구분"));
    if (zoneIdx === -1) zoneIdx = headers.findIndex(h => h.includes("구역") || h.includes("위치"));
    
    if (centerIdx === -1) centerIdx = 0; 
    if (zoneIdx === -1) zoneIdx = 1;

    let mapping = {};
    
    for (let i = 1; i < data.length; i++) {
      const center = String(data[i][centerIdx] || "").trim();
      const zone = String(data[i][zoneIdx] || "").trim();
      
      if (!center || center === "undefined" || center === "null" || center === "센터 구분") continue;
      
      if (!mapping[center]) {
        mapping[center] = [];
      }
      
      if (zone && zone !== "undefined" && zone !== "null" && zone !== "구역 구분" && !mapping[center].includes(zone)) {
        mapping[center].push(zone);
      }
    }
    
    // 가나다순/숫자순 정렬
    for (let center in mapping) {
      mapping[center].sort();
    }
    
    return ContentService.createTextOutput(JSON.stringify(mapping))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'listSheets') {
    const sheets = ss.getSheets()
      .map(s => s.getName())
      .filter(name => name.includes('마스터파일')); 
    return ContentService.createTextOutput(JSON.stringify(sheets))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheetName = e.parameter.sheetName || "마스터파일";
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

  const headers = rows[0];
  const resultData = [];
  for (var i = 1; i < rows.length; i++) {
    var rowData = {};
    for (var j = 0; j < headers.length; j++) {
      rowData[headers[j]] = rows[i][j];
    }
    resultData.push(rowData);
  }
  return ContentService.createTextOutput(JSON.stringify(resultData)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (payload.action === "audit") {
      return handleAuditUpdate(ss, payload.rows);
    } else {
      return handleChecklistSync(ss, payload.rows);
    }
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}

function handleChecklistSync(ss, rowsToProcess, options) {
  const sheetName = "체크리스트_데이터";
  let sheet = ss.getSheetByName(sheetName);
  const targetHeaders = ["관리번호", "자산번호", "상품코드", "상품명", "제조사", "모델", "년식", "차량번호", "차대번호", "자산실사일", "자산실사 여부", "이상자산구분", "QR", "센터위치", "자산위치", "자산실사자"];
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(targetHeaders);
  }
  const setAbnormalOnInsert = options && options.setAbnormalOnInsert === true;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const mgmtColIdx = headers.indexOf("관리번호");
  const qrColIdx = headers.indexOf("QR");
  const abnormalAssetColIdx = headers.indexOf("이상자산구분");
  rowsToProcess.forEach(function(item) {
    const targetMgmtNo = cleanValue(item["관리번호"]);
    if (!targetMgmtNo) return;
    let foundRowIndex = -1;
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const mgmtColumnData = sheet.getRange(1, mgmtColIdx + 1, lastRow).getValues();
      for (let i = 1; i < mgmtColumnData.length; i++) {
        if (cleanValue(mgmtColumnData[i][0]) === targetMgmtNo) {
          foundRowIndex = i + 1;
          break;
        }
      }
    }
    if (foundRowIndex > -1) {
      headers.forEach(function(h, idx) {
        if (h === "QR") return;
        // 자산실사자 컬럼은 빈 문자열도 업데이트 (실사자 정보 갱신을 위해)
        if (h === "자산실사자") {
          if (item[h] !== undefined && item[h] !== null) {
            sheet.getRange(foundRowIndex, idx + 1).setValue(item[h]);
          }
        } else if (item[h] !== undefined && item[h] !== null && item[h] !== "") {
          sheet.getRange(foundRowIndex, idx + 1).setValue(item[h]);
        }
      });
    } else {
      const newRow = headers.map(function(h) {
        if (h === "QR") return ""; 
        return item[h] || "";
      });
      sheet.appendRow(newRow);
      const currentRowIdx = sheet.getLastRow();
      if (qrColIdx > -1) {
        const qrCell = sheet.getRange(currentRowIdx, qrColIdx + 1);
        const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(targetMgmtNo) + '")';
        qrCell.setFormula(qrFormula);
      }
      // 이상자산구분 규칙:
      // - checklist 저장(action=checklist): 신규 생성이어도 자동 'O' 금지 (payload에 'O'가 명시된 경우만)
      // - audit 저장(action=audit): 체크리스트 없이 실사된 케이스는 신규 생성 + 'O' 자동 세팅
      const abnormalFlag = cleanValue(item["이상자산구분"]);
      const shouldSetAbnormal =
        setAbnormalOnInsert || String(abnormalFlag || "").toUpperCase() === "O";
      if (abnormalAssetColIdx > -1 && shouldSetAbnormal) {
        sheet.getRange(currentRowIdx, abnormalAssetColIdx + 1).setValue("O");
      }
      // 신규 추가 시에도 자산실사자 정보 업데이트 (있는 경우)
      const auditUserColIdx = headers.indexOf("자산실사자");
      if (auditUserColIdx > -1 && item["자산실사자"]) {
        sheet.getRange(currentRowIdx, auditUserColIdx + 1).setValue(item["자산실사자"]);
      }
    }
  });
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function handleAuditUpdate(ss, rowsToProcess) {
  // 실사(QR) 먼저 찍은 케이스: 체크리스트_데이터에 관리번호가 없으면 신규 생성 + 이상자산구분 'O'
  return handleChecklistSync(ss, rowsToProcess, { setAbnormalOnInsert: true });
}

function cleanValue(val) {
  if (val === null || val === undefined) return "";
  var s = String(val).trim();
  if (s.indexOf("'") === 0) s = s.substring(1);
  return s;
}

/**
 * 체크리스트 데이터 조회
 * 체크리스트_데이터 시트의 모든 데이터를 조회합니다.
 * @param {Object} params - 필터 파라미터 {search?, sortBy?, sortOrder?, page?, pageSize?}
 * @return {Array|Object} 체크리스트 데이터 배열 또는 페이징 객체
 */
function getChecklistData(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '체크리스트_데이터';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 데이터 가져오기
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // QR 컬럼 인덱스 찾기
    const qrColIndex = headers.findIndex(h => String(h).trim() === 'QR');
    
    // 데이터 변환
    let checklistData = rows.map((row, index) => {
      const obj = {
        _rowIndex: index + 1 // 헤더를 제외한 데이터 행 번호 (1부터 시작)
      };
      headers.forEach((header, colIndex) => {
        const headerName = String(header).trim();
        const cellValue = row[colIndex];
        
        // QR 컬럼인 경우 수식에서 URL 추출
        if (headerName === 'QR' && qrColIndex >= 0) {
          try {
            const actualRowIndex = index + 2; // 시트의 실제 행 번호 (헤더 포함)
            const cell = sheet.getRange(actualRowIndex, qrColIndex + 1);
            const formula = cell.getFormula();
            
            if (formula && formula.startsWith('=IMAGE(')) {
              // 수식에서 URL 추출: =IMAGE("URL")
              const urlMatch = formula.match(/=IMAGE\("([^"]+)"/);
              if (urlMatch && urlMatch[1]) {
                obj[headerName] = urlMatch[1];
              } else {
                obj[headerName] = '';
              }
            } else {
              obj[headerName] = '';
            }
          } catch (e) {
            obj[headerName] = '';
          }
        } else {
          // 값 변환: Date 객체나 다른 객체를 문자열로 변환
          if (cellValue === null || cellValue === undefined || cellValue === '') {
            obj[headerName] = '';
          } else if (cellValue instanceof Date) {
            // Date 객체를 문자열로 변환 (KST ISO +09:00로 통일)
            const base = Utilities.formatDate(cellValue, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss");
            obj[headerName] = base + '+09:00';
          } else if (typeof cellValue === 'object') {
            // 다른 객체인 경우 문자열로 변환 시도
            try {
              obj[headerName] = String(cellValue);
            } catch (e) {
              obj[headerName] = '';
            }
          } else {
            obj[headerName] = String(cellValue);
          }
        }
      });
      return obj;
    });
    
    // 검색 필터 적용
    if (params && params.search) {
      const searchTerm = String(params.search).toLowerCase();
      checklistData = checklistData.filter(row => {
        return Object.values(row).some(value => 
          String(value).toLowerCase().includes(searchTerm)
        );
      });
    }
    
    // 정렬 적용
    if (params && params.sortBy) {
      const sortBy = params.sortBy;
      const sortOrder = params.sortOrder || 'asc';
      checklistData.sort((a, b) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    // 페이징 적용
    if (params && params.page && params.pageSize) {
      const page = parseInt(params.page) || 1;
      const pageSize = parseInt(params.pageSize) || 20;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = checklistData.slice(startIndex, endIndex);
      
      const result = {
        data: paginatedData,
        total: checklistData.length,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(checklistData.length / pageSize)
      };
      
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify(checklistData))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('getChecklistData error: ' + error);
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
