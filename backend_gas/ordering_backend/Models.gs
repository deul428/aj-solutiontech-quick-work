// ==========================================
// 데이터 접근 레이어 (DAL)
// ==========================================

class RequestModel {
  constructor() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // CONFIG 누락/공백 등 이슈 대비 + 시트명 loose 매칭 지원
    const sheetName = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.REQUESTS)
      ? String(CONFIG.SHEETS.REQUESTS).trim()
      : '신청내역';

    // getSheetByNameLoose_ 가 있으면 우선 사용 (공백/유사명 대응)
    if (typeof getSheetByNameLoose_ === 'function') {
      this.sheet = getSheetByNameLoose_(ss, sheetName);
    } else {
      this.sheet = ss.getSheetByName(sheetName);
    }
    
    // 시트가 없으면 null로 설정
    if (!this.sheet) {
      Logger.log('RequestModel: Sheet "' + sheetName + '" not found');
    }
  }
  
  // 전체 조회 (서버 측 필터링 및 페이징 지원)
  findAll(filter = {}, options = {}) {
    try {
      // 시트가 없으면 빈 배열 반환
      if (!this.sheet) {
        log('WARN', 'RequestModel.findAll: Sheet not found');
        return options.page ? { data: [], total: 0, page: 1, pageSize: 0 } : [];
      }
      
      const data = this.sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return options.page ? { data: [], total: 0, page: 1, pageSize: 0 } : [];
      }
      
      const headers = data[0];
      const rows = data.slice(1);
      const objects = rows.map((row, index) => this._rowToObject(headers, row, index + 2));
      
      // 서버 측 필터링
      let filtered = objects.filter(obj => this._matchFilter(obj, filter));
      
      // 정렬 (서버 측)
      if (options.sortBy) {
        filtered = this._sort(filtered, options.sortBy, options.sortOrder || 'desc');
      } else {
        // 기본 정렬: 최신순 (requestDate 기준)
        filtered = this._sort(filtered, 'requestDate', 'desc');
      }
      
      const total = filtered.length;
      
      // 서버 측 페이징
      if (options.page && options.pageSize) {
        const startIndex = (options.page - 1) * options.pageSize;
        const endIndex = startIndex + options.pageSize;
        filtered = filtered.slice(startIndex, endIndex);
        
        return {
          data: filtered,
          total: total,
          page: options.page,
          pageSize: options.pageSize,
          totalPages: Math.ceil(total / options.pageSize)
        };
      }
      
      // 페이징 옵션이 없으면 기존 방식 (하위 호환성)
      return filtered;
    } catch (error) {
      log('ERROR', 'RequestModel.findAll error: ' + error);
      throw error;
    }
  }
  
  // 정렬 헬퍼
  _sort(array, sortBy, sortOrder = 'asc') {
    return array.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // 날짜 필드 처리
      if (sortBy === 'requestDate' || sortBy === 'orderDate' || sortBy === 'receiptDate') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      
      // 숫자 필드 처리
      if (sortBy === 'quantity') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }
      
      // 문자열 필드 처리
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
      }
      if (typeof bVal === 'string') {
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // ID로 조회
  findById(requestNo) {
    const data = this.sheet.getDataRange().getValues();
    if (data.length <= 1) return null;
    
    const headers = data[0];
    const requestNoStr = String(requestNo); // 문자열로 변환
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === requestNoStr) {
        return this._rowToObject(headers, data[i], i + 1);
      }
    }
    
    return null;
  }
  
  // 생성
  create(requestData) {
    const row = this._objectToRow(requestData);
    this.sheet.appendRow(row);
    return requestData;
  }
  
  // 수정 (배치 업데이트 최적화)
  update(requestNo, updates) {
    if (!this.sheet) return false;
    
    const data = this.sheet.getDataRange().getValues();
    const requestNoStr = String(requestNo);
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === requestNoStr) {
        // 배치 업데이트: 여러 셀을 한 번에 업데이트
        const updatesArray = [];
        Object.keys(updates).forEach(key => {
          const colIndex = this._getColumnIndex(key);
          if (colIndex >= 0) {
            updatesArray.push({
              range: this.sheet.getRange(i + 1, colIndex + 1),
              value: updates[key]
            });
          }
        });
        
        // 한 번에 업데이트 (배치 처리)
        updatesArray.forEach(update => {
          update.range.setValue(update.value);
        });
        
        return true;
      }
    }
    return false;
  }
  
  // 삭제 (실제로는 상태 변경)
  delete(requestNo) {
    return this.update(requestNo, { 
      status: CONFIG.STATUS.CANCELLED,
      // 날짜/시간 저장 포맷 통일 (KST ISO +09:00)
      lastModified: formatKstIsoDateTime(new Date())
    });
  }
  
  // Private 메서드들
  _rowToObject(headers, row, rowIndex) {
    const obj = { _rowIndex: rowIndex };
    headers.forEach((header, index) => {
      const key = this._headerToKey(header);
      // requestNo는 항상 문자열로 변환
      if (key === 'requestNo' && row[index]) {
        obj[key] = String(row[index]);
      } else {
        obj[key] = row[index];
      }
    });
    // 레거시 정규화:
    // - 과거 데이터는 신청자ID가 '신청자이메일' 컬럼(requesterEmail)에 저장되었을 수 있으므로
    //   requesterUserId가 비어있으면 requesterEmail을 사용자ID로 간주해 채웁니다.
    if (!obj.requesterUserId && obj.requesterEmail) {
      obj.requesterUserId = obj.requesterEmail;
    }
    return obj;
  }
  
  _objectToRow(obj) {
    const headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
    return headers.map(header => {
      const key = this._headerToKey(header);
      return obj[key] !== undefined ? obj[key] : '';
    });
  }
  
  _headerToKey(header) {
    // 헤더 정규화:
    // - 공백/개행/탭 제거
    // - zero-width 문자 제거 (복사/붙여넣기 시 섞이는 경우)
    const normalizeHeader_ = (v) =>
      String(v === null || v === undefined ? '' : v)
        .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
        .trim();
    const h = normalizeHeader_(header);
    const map = {
      '신청번호': 'requestNo',
      '신청일시': 'requestDate',   
      // 신청자 식별자 컬럼은 운영 중 헤더명이 다를 수 있어 변형을 함께 지원합니다.
      '신청자아이디': 'requesterUserId',
      '신청자ID': 'requesterUserId',
      '신청자이메일': 'requesterEmail',
      '신청자이름': 'requesterName',
      '기사코드': 'employeeCode',
      '소속팀': 'team',
      '지역': 'region',
      '품명': 'itemName',
      '모델명': 'modelName',
      '규격': 'modelName', // 모델명 -> 규격으로 변경
      '시리얼번호': 'serialNo',
      '수량': 'quantity',
      '관리번호': 'assetNo',
      '수령지': 'deliveryPlace', // 하위 호환성 유지
      '배송지': 'deliveryPlace',
      '전화번호': 'phone',
      '업체명': 'company',
      '비고': 'remarks',
      '사진URL': 'photoUrl',
      '상태': 'status',
      '접수담당자': 'handler',
      '접수담당자명': 'handler',
      '접수담당자이름': 'handler',
      '접수담당자메일': 'handler',
      '접수담당자이메일': 'handler',
      '담당자비고': 'handlerRemarks',
      '발주일시': 'orderDate',
      '예상납기일시': 'expectedDeliveryDate',
      '수령확인일시': 'receiptDate',
      '최종수정일시': 'lastModified',
      '최종수정자': 'lastModifiedBy'
    };
    return map[h] || h;
  }
  
  _getColumnIndex(key) {
    // 시트 컬럼 순서가 바뀌어도 동작하도록 "헤더명 기반"으로 컬럼 위치를 찾습니다.
    // (reverseMap 고정 인덱스 방식은 운영 중 컬럼 변경에 취약)
    try {
      if (!this.sheet) return -1;
      const headers = this.sheet
        .getRange(1, 1, 1, this.sheet.getLastColumn())
        .getValues()[0];

      for (let i = 0; i < headers.length; i++) {
        const mappedKey = this._headerToKey(headers[i]);
        if (mappedKey === key) return i;
      }
      return -1;
    } catch (e) {
      Logger.log('_getColumnIndex error: ' + e);
      return -1;
    }
  }
  
  _matchFilter(obj, filter) {
    if (filter.status && obj.status !== filter.status) return false;
    // 사용자 ID 기반 필터링 지원 (신규: requesterUserId, 레거시: requesterEmail에 사용자ID가 저장된 경우)
    const objRequesterUserId = String(obj.requesterUserId || obj.requesterEmail || '').trim();
    if (filter.requesterUserId && objRequesterUserId !== String(filter.requesterUserId || '').trim()) return false;
    // 하위 호환성: requesterEmail 파라미터가 들어오면 "신청자ID"로 취급
    if (filter.requesterEmail && objRequesterUserId !== String(filter.requesterEmail || '').trim()) return false;
    if (filter.region && obj.region !== filter.region) return false;
    // 관리번호 필터링 지원
    if (filter.assetNo && String(obj.assetNo || '').trim() !== String(filter.assetNo || '').trim()) return false;
    
    // 날짜 필터링 - 안전한 비교
    if (filter.dateFrom || filter.dateTo) {
      try {
        if (!obj.requestDate) return false;
        
        // requestDate를 YYYY-MM-DD 문자열로 정규화
        // - 신규 데이터는 "YYYY-MM-DDTHH:mm:ss+09:00" (KST ISO)로 저장
        // - 레거시 데이터는 "YYYY. M. D 오전/오후 ..." 등도 존재 가능
        let reqDateStr = '';
        if (obj.requestDate instanceof Date) {
          reqDateStr = formatKstDateOnly(obj.requestDate);
        } else {
          const dateStr = String(obj.requestDate).trim();
          // ISO / "YYYY-MM-DD ..." 계열: 앞 10자리 사용
          const mIsoLike = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
          if (mIsoLike) {
            reqDateStr = mIsoLike[1];
          } else {
            // "2026. 1. 7 오전 9:45:44" → y-m-d
            const parts = dateStr.split(' ')[0].split('.').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 3 && /^\d{4}$/.test(parts[0])) {
              const year = parts[0];
              const month = String(parts[1] || '').padStart(2, '0');
              const day = String(parts[2] || '').padStart(2, '0');
              reqDateStr = `${year}-${month}-${day}`;
            } else {
              // 최후 fallback: Date 파싱 시도
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) {
                reqDateStr = formatKstDateOnly(d);
              } else {
                reqDateStr = dateStr.split(' ')[0];
              }
            }
          }
        }
        
        // 문자열 비교 (YYYY-MM-DD 형식)
        if (filter.dateFrom && reqDateStr < filter.dateFrom) return false;
        if (filter.dateTo && reqDateStr > filter.dateTo) return false;
      } catch (dateError) {
        Logger.log('Date filter error: ' + dateError);
        // 날짜 비교 오류 시 해당 항목 제외하지 않음 (포함)
      }
    }
    
    return true;
  }
}

class UserModel {
  constructor() {
    try {
      this.sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(CONFIG.SHEETS.USERS);
      if (!this.sheet) {
        Logger.log('UserModel: Users sheet not found');
      }
    } catch (error) {
      Logger.log('UserModel constructor error: ' + error);
      this.sheet = null;
    }
  }
  
  /**
   * 헤더 이름으로 컬럼 인덱스 찾기
   * @param {Array} headers - 헤더 배열
   * @param {string} headerName - 찾을 헤더 이름
   * @return {number} 컬럼 인덱스 (-1 if not found)
   */
  _getColumnIndex(headers, headerName) {
    return headers.indexOf(headerName);
  }
  
  /**
   * 사용자 ID로 사용자 조회
   * @param {string} userId - 사용자 ID
   * @return {Object|null} 사용자 정보
   */
  findByUserId(userId) {
    if (!this.sheet) {
      Logger.log('findByUserId: Users sheet not found');
      return null;
    }
    
    if (!userId) {
      Logger.log('findByUserId: userId is empty');
      return null;
    }
    
    try {
      const data = this.sheet.getDataRange().getValues();
      if (data.length <= 1) return null;
    
      // 헤더 가져오기
      const headers = data[0];
      const userIdCol = this._getColumnIndex(headers, '사용자ID');
      const passwordHashCol = this._getColumnIndex(headers, '비밀번호해시');
      const nameCol = this._getColumnIndex(headers, '이름');
      const employeeCodeCol = this._getColumnIndex(headers, '기사코드');
      const teamCol = this._getColumnIndex(headers, '소속팀');
      const regionCol = this._getColumnIndex(headers, '지역');
      const roleCol = this._getColumnIndex(headers, '역할');
      const activeCol = this._getColumnIndex(headers, '활성화');
      
      // 필수 컬럼 확인
      if (userIdCol < 0) {
        Logger.log('findByUserId: 사용자ID 컬럼을 찾을 수 없습니다.');
        return null;
      }
    
      // userId를 문자열로 정규화 (시트의 값이 숫자일 수도 있음)
      const normalizedUserId = String(userId).trim();
    
      for (let i = 1; i < data.length; i++) {
        // 시트의 userId도 문자열로 변환하여 비교 (타입 불일치 방지)
        const sheetUserId = String(data[i][userIdCol] || '').trim();
        
        if (sheetUserId === normalizedUserId) {
          return {
            userId: data[i][userIdCol],
            passwordHash: passwordHashCol >= 0 ? data[i][passwordHashCol] : '',
            name: nameCol >= 0 ? data[i][nameCol] : '',
            employeeCode: employeeCodeCol >= 0 ? data[i][employeeCodeCol] : '',
            team: teamCol >= 0 ? data[i][teamCol] : '',
            region: regionCol >= 0 ? data[i][regionCol] : '',
            role: roleCol >= 0 ? data[i][roleCol] : '',
            active: activeCol >= 0 ? data[i][activeCol] : ''
          };
        }
      }
      return null;
    } catch (error) {
      Logger.log('findByUserId error: ' + error);
      return null;
    }
  }
  
  /**
   * 이메일로 사용자 조회 (하위 호환성)
   * @param {string} email - 이메일
   * @return {Object|null} 사용자 정보
   */
  findByEmail(email) {
    // 사용자ID 컬럼에서 이메일 형식도 검색
    return this.findByUserId(email);
  }
  
  /**
   * 비밀번호 업데이트
   * @param {string} userId - 사용자 ID
   * @param {string} passwordHash - 새 비밀번호 해시
   */
  updatePassword(userId, passwordHash) {
    if (!this.sheet) {
      Logger.log('updatePassword: Users sheet not found');
      return false;
    }
    
    const data = this.sheet.getDataRange().getValues();
    if (data.length <= 1) return false;
    
    // 헤더 가져오기
    const headers = data[0];
    const userIdCol = this._getColumnIndex(headers, '사용자ID');
    const passwordHashCol = this._getColumnIndex(headers, '비밀번호해시');
    
    if (userIdCol < 0 || passwordHashCol < 0) {
      Logger.log('updatePassword: 필수 컬럼을 찾을 수 없습니다.');
      return false;
    }
    
    const normalizedUserId = String(userId).trim();
    
    for (let i = 1; i < data.length; i++) {
      const sheetUserId = String(data[i][userIdCol] || '').trim();
      if (sheetUserId === normalizedUserId) {
        this.sheet.getRange(i + 1, passwordHashCol + 1).setValue(passwordHash);
        return true;
      }
    }
    return false;
  }
  
  findAllAdmins() {
    if (!this.sheet) {
      Logger.log('findAllAdmins: Users sheet not found');
      return [];
    }
    
    const data = this.sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    // 헤더 가져오기
    const headers = data[0];
    const userIdCol = this._getColumnIndex(headers, '사용자ID');
    const nameCol = this._getColumnIndex(headers, '이름');
    const roleCol = this._getColumnIndex(headers, '역할');
    const activeCol = this._getColumnIndex(headers, '활성화');
    
    if (userIdCol < 0 || roleCol < 0 || activeCol < 0) {
      Logger.log('findAllAdmins: 필수 컬럼을 찾을 수 없습니다.');
      return [];
    }
    
    const admins = [];
    for (let i = 1; i < data.length; i++) {
      const role = data[i][roleCol];
      const active = data[i][activeCol];
      if (role === CONFIG.ROLES.ADMIN && active === 'Y') {
        admins.push({
          userId: data[i][userIdCol],
          name: nameCol >= 0 ? data[i][nameCol] : ''
        });
      }
    }
    return admins;
  }
}

class CodeModel {
  constructor() {
    this.sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.CODES);
  }
  
  getRegions() {
    return this._getCodes(1, 20);
  }
  
  getTeams() {
    const data = this.sheet.getDataRange().getValues();
    const teams = [];
    
    // 소속팀 섹션 찾기 (빈 행 이후)
    let startRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === '코드' && data[i][1] === '팀명') {
        startRow = i;
        break;
      }
    }
    
    if (startRow === -1) return [];
    
    for (let i = startRow + 1; i < data.length && i < startRow + 20; i++) {
      if (data[i][0] && data[i][3] === 'Y') {
        teams.push({
          code: data[i][0],
          name: data[i][1],
          region: data[i][2] || null
        });
      }
    }
    
    return teams;
  }
  
  getStatusList() {
    const data = this.sheet.getDataRange().getValues();
    const statuses = [];
    
    // 상태 섹션 찾기
    let startRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === '코드' && data[i][1] === '상태명') {
        startRow = i;
        break;
      }
    }
    
    if (startRow === -1) return [];
    
    for (let i = startRow + 1; i < data.length && i < startRow + 20; i++) {
      if (data[i][0] && data[i][2] === 'Y') {
        statuses.push({
          code: data[i][0],
          name: data[i][1],
          color: data[i][3] || null
        });
      }
    }
    
    return statuses;
  }
  
  _getCodes(startRow, maxRows) {
    const data = this.sheet.getDataRange().getValues();
    const codes = [];
    
    for (let i = startRow; i < data.length && i < startRow + maxRows; i++) {
      if (data[i][0] && data[i][2] === 'Y') {
        codes.push({
          code: data[i][0],
          name: data[i][1],
          extra: data[i][3] || null
        });
      }
    }
    
    return codes;
  }
}

class DeliveryPlaceModel {
  constructor() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // CONFIG 누락/캐시 이슈 대비 fallback
    const sheetName = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.DELIVERY_PLACES)
      ? String(CONFIG.SHEETS.DELIVERY_PLACES).trim()
      : '배송지관리';
    
    // 기존 시트만 찾기 (생성하지 않음) - trim 느슨매칭
    this.sheet = ss.getSheetByName(sheetName);
    if (!this.sheet) {
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i];
        const n = String(s.getName() || '');
        if (n.trim() === sheetName) {
          // 가능하면 canonicalName으로 rename 시도
          if (n !== sheetName) {
            try { s.setName(sheetName); } catch (e) {}
          }
          this.sheet = s;
          break;
        }
      }
    }
  }
  
  /**
   * 파트별 배송지 목록 조회
   * @param {string} team - 소속팀 (선택사항)
   * @return {Array} 배송지 목록
   */
  findByTeam(team) {
    if (!this.sheet) return [];
    
    const data = this.sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    const places = rows
      .filter(row => {
        // 활성화된 배송지만
        const activeIndex = headers.indexOf('활성화');
        if (activeIndex >= 0 && row[activeIndex] !== 'Y') return false;
        
        // 팀 필터 적용
        if (team) {
          const teamIndex = headers.indexOf('소속팀');
          if (teamIndex >= 0 && row[teamIndex] !== team) return false;
        }
        
        return true;
      })
      .map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
    
    return places;
  }
  
  /**
   * 모든 배송지 목록 조회
   * @return {Array} 배송지 목록
   */
  findAll() {
    if (!this.sheet) return [];
    return this.findByTeam(null);
  }
  
  /**
   * 배송지 생성
   * @param {Object} placeData - 배송지 데이터
   * @return {Object} 생성된 배송지
   */
  create(placeData) {
    if (!this.sheet) {
      throw new Error('배송지관리 시트를 찾을 수 없습니다.');
    }
    const headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => placeData[header] || '');
    this.sheet.appendRow(row);
    return placeData;
  }
  
  /**
   * 배송지 수정
   * @param {number} rowIndex - 행 인덱스 (1-based)
   * @param {Object} updates - 수정할 데이터
   * @return {boolean} 성공 여부
   */
  update(rowIndex, updates) {
    const headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
    Object.keys(updates).forEach(key => {
      const colIndex = headers.indexOf(key);
      if (colIndex >= 0) {
        this.sheet.getRange(rowIndex, colIndex + 1).setValue(updates[key]);
      }
    });
    return true;
  }
  
  /**
   * 배송지 삭제 (활성화 상태 변경)
   * @param {number} rowIndex - 행 인덱스 (1-based)
   * @return {boolean} 성공 여부
   */
  delete(rowIndex) {
    const headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
    const activeIndex = headers.indexOf('활성화');
    if (activeIndex >= 0) {
      this.sheet.getRange(rowIndex, activeIndex + 1).setValue('N');
      return true;
    }
    return false;
  }
}

