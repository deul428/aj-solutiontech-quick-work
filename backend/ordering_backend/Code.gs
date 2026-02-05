// ==========================================
// 메인 엔트리 포인트 및 Public API
// ==========================================

// 공통 JSON 응답 생성 (CORS 포함)
// 참고: Google Apps Script의 ContentService는 HTTP 헤더를 직접 설정할 수 없습니다.
// CORS는 배포 설정에서 "Execute as: Me" 및 "Who has access: Anyone"으로 설정해야 합니다.
function createJsonResponse_(result) {
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 웹 앱 진입점 (HTML 페이지 또는 REST API)
function doGet(e) {
  try {
    // e 또는 e.parameter가 없을 수 있으므로 안전하게 처리
    if (!e) {
      e = {};
    }
    if (!e.parameter) {
      e.parameter = {};
    }
    
    // REST API 요청 처리 (action 파라미터가 있으면 JSON 반환)
    const action = e.parameter.action;
    if (action) {
      // REST API인 경우 JSON + CORS 헤더로 응답
      return handleGetApi(action, e.parameter);
    }
    
    // URL 파라미터 확인
    const page = e.parameter.page;
    const sessionToken = e.parameter.token;
    
    // 실제 웹 앱 URL 가져오기
    const webAppUrl = getWebAppUrl();
    
    // 로그인 페이지 요청인 경우
    if (page === 'login' || !page) {
      const template = HtmlService.createTemplateFromFile('LoginPage');
      // 웹 앱 URL이 있으면 템플릿에 전달
      if (webAppUrl && webAppUrl.trim() !== '') {
        template.webAppUrl = webAppUrl;
      }
      return template
        .evaluate()
        .setTitle('로그인');
    }
    
    // 세션 확인
    const user = getCurrentSession(sessionToken);
    
    if (!user) {
      // 세션이 없으면 로그인 페이지로 리다이렉트
      Logger.log('No valid session');
      return HtmlService.createTemplateFromFile('LoginPage')
        .evaluate()
        .setTitle('로그인');
    }
    
    // 디버깅: 사용자 정보 로그
    Logger.log('Current user: ' + user.userId + ', Role: ' + user.role);
    
    // 페이지별 라우팅
    if (page === 'admin' || page === 'admin-dashboard' || (user.role === CONFIG.ROLES.ADMIN && !page)) {
      // 관리자 대시보드
      return HtmlService.createTemplateFromFile('AdminDashboardPage')
        .evaluate()
        .setTitle('관리자 대시보드');
    } else if (page === 'admin-requests') {
      // 전체 신청 목록
      return HtmlService.createTemplateFromFile('AdminPage')
        .evaluate()
        .setTitle('전체 신청 목록');
    } else if (page === 'admin-detail') {
      // 신청 상세 관리
      return HtmlService.createTemplateFromFile('AdminRequestDetailPage')
        .evaluate()
        .setTitle('신청 상세 관리');
    } else if (page === 'admin-statistics') {
      // 통계 및 리포트
      return HtmlService.createTemplateFromFile('AdminStatisticsPage')
        .evaluate()
        .setTitle('통계 및 리포트');
    } else if (page === 'admin-master') {
      // 기준정보 관리
      return HtmlService.createTemplateFromFile('AdminMasterPage')
        .evaluate()
        .setTitle('기준정보 관리');
    } else if (page === 'my-info') {
      // 내 정보
      return HtmlService.createTemplateFromFile('MyInfoPage')
        .evaluate()
        .setTitle('내 정보');
    } else if (page === 'user' || page === 'dashboard' || (user.role === CONFIG.ROLES.USER && !page)) {
      // 신청자 대시보드 (명세서 기반)
      return HtmlService.createTemplateFromFile('UserDashboard')
        .evaluate()
        .setTitle('부품발주 대시보드');
    } else if (page === 'my-requests') {
      // 내 신청 목록
      return HtmlService.createTemplateFromFile('MyRequestsPage')
        .evaluate()
        .setTitle('내 신청 목록');
    } else if (page === 'new-request') {
      // 신청 등록 화면
      return HtmlService.createTemplateFromFile('NewRequestPage')
        .evaluate()
        .setTitle('신청 등록');
    } else if (page === 'detail') {
      // 신청 상세 조회
      return HtmlService.createTemplateFromFile('RequestDetailPage')
        .evaluate()
        .setTitle('신청 상세');
    } else {
      // 기본: 역할에 따라 페이지 이동
      if (user.role === CONFIG.ROLES.ADMIN) {
        return HtmlService.createTemplateFromFile('AdminDashboardPage')
          .evaluate()
          .setTitle('관리자 대시보드');
      } else {
        return HtmlService.createTemplateFromFile('UserDashboard')
          .evaluate()
          .setTitle('부품발주 대시보드');
      }
    }
  } catch (error) {
    Logger.log('doGet error: ' + error);
    Logger.log('doGet error stack: ' + error.stack);
    
    // 에러 상세 정보를 포함한 HTML 반환
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>오류</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>페이지 로드 오류</h2>
          <p><strong>오류 메시지:</strong> ${error.message || '알 수 없는 오류'}</p>
          <p><strong>오류 타입:</strong> ${error.name || 'Error'}</p>
          <button onclick="window.location.href='?page=login'">로그인 페이지로 이동</button>
        </div>
      </body>
      </html>
    `;
    
    return HtmlService.createHtmlOutput(errorHtml).setTitle('오류');
  }
}

// ==========================================
// 사용자 API
// ==========================================

/**
 * 웹 앱의 실제 배포 URL을 반환합니다.
 * @return {string} 웹 앱 배포 URL
 */
/**
 * 배포된 웹 앱의 실제 URL을 반환합니다.
 * @return {string} 웹 앱 URL
 */
function getWebAppUrl() {
  try {
    const service = ScriptApp.getService();
    if (service) {
      return service.getUrl() || '';
    }
    return '';
  } catch (error) {
    Logger.log('getWebAppUrl error: ' + error);
    return '';
  }
}

/**
 * 현재 로그인한 사용자 정보를 조회합니다. (세션 기반)
 * @param {string} sessionToken - 세션 토큰
 * @return {Object|null} 사용자 정보 객체 또는 null
 */
function getCurrentUser(sessionToken) {
  try {
    return getCurrentSession(sessionToken);
  } catch (error) {
    Logger.log('getCurrentUser error: ' + error);
    return null;
  }
}

/**
 * 현재 사용자의 신청 목록을 조회합니다.
 * @param {Object} filter - 필터 옵션 (status, dateFrom, dateTo 등)
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 신청 목록 배열
 */
function getMyRequests(filter = {}, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      log('ERROR', 'getMyRequests: User not found');
      return [];
    }
    
    // 사용자 ID 기반으로 필터링
    filter.requesterUserId = user.userId;
    filter.requesterEmail = user.userId; // 하위 호환성
    
    const requestModel = new RequestModel();
    
    // 시트 존재 여부 확인
    if (!requestModel.sheet) {
      log('WARN', 'getMyRequests: Request sheet not found');
      return [];
    }
    
    // 페이징 옵션 준비
    const options = {};
    if (filter.page && filter.pageSize) {
      options.page = parseInt(filter.page);
      options.pageSize = parseInt(filter.pageSize);
      options.sortBy = filter.sortBy || 'requestDate';
      options.sortOrder = filter.sortOrder || 'desc';
    }
    
    // 서버 측 필터 (페이징 옵션 제외)
    const serverFilter = {
      requesterUserId: filter.requesterUserId,
      requesterEmail: filter.requesterEmail,
      status: filter.status,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo
    };
    
    const result = requestModel.findAll(serverFilter, options);
    
    // 포맷팅 함수
    const formatRequest = function(req) {
      return {
        requestNo: req.requestNo,
        requestDate: formatDate(req.requestDate, 'yyyy-MM-dd HH:mm'),
        requesterName: req.requesterName || '',
        employeeCode: req.employeeCode || '',
        team: req.team || '',
        region: req.region || '',
        itemName: req.itemName,
        modelName: req.modelName || '',
        serialNo: req.serialNo || '',
        quantity: req.quantity,
        assetNo: req.assetNo,
        deliveryPlace: req.deliveryPlace || '',
        phone: req.phone || '',
        company: req.company || '',
        remarks: req.remarks || '',
        photoUrl: req.photoUrl || '',
        status: req.status,
        handler: req.handler || '',
        handlerRemarks: req.handlerRemarks || '',
        orderDate: req.orderDate ? formatDate(req.orderDate, 'yyyy-MM-dd HH:mm') : '',
        expectedDeliveryDate: req.expectedDeliveryDate ? formatDate(req.expectedDeliveryDate, 'yyyy-MM-dd') : '',
        receiptDate: req.receiptDate ? formatDate(req.receiptDate, 'yyyy-MM-dd HH:mm') : '',
        canCancel: req.status === CONFIG.STATUS.REQUESTED,
        canConfirmReceipt: req.status === CONFIG.STATUS.COMPLETED_CONFIRMED || req.status === CONFIG.STATUS.COMPLETED_PENDING
      };
    };
    
    // 페이징 결과인 경우
    if (result && result.data && Array.isArray(result.data)) {
      return {
        data: result.data.map(formatRequest),
        total: result.total || 0,
        page: result.page || 1,
        pageSize: result.pageSize || 20,
        totalPages: result.totalPages || 1
      };
    }
    
    // 배열 결과인 경우 (하위 호환성)
    if (Array.isArray(result)) {
      let formatted = result.map(formatRequest);
      
      // 정렬 적용
      if (options.sortBy) {
        const sortField = options.sortBy;
        const sortOrder = options.sortOrder || 'desc';
        
        formatted.sort((a, b) => {
          let aValue = a[sortField];
          let bValue = b[sortField];
          
          // 날짜 필드인 경우 Date 객체로 변환
          if (sortField === 'requestDate' || sortField === 'orderDate' || sortField === 'receiptDate') {
            aValue = new Date(aValue || 0);
            bValue = new Date(bValue || 0);
          }
          
          // 숫자 필드인 경우
          if (sortField === 'quantity' || sortField === 'employeeCode') {
            aValue = Number(aValue) || 0;
            bValue = Number(bValue) || 0;
          }
          
          // 문자열 비교
          if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      } else {
        // 정렬 옵션이 없으면 역순 정렬 (최신순)
        formatted = formatted.reverse();
      }
      
      // 페이징 옵션이 있으면 페이징 정보 포함 객체 반환
      if (options.page && options.pageSize) {
        const total = formatted.length;
        const page = options.page;
        const pageSize = options.pageSize;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = formatted.slice(startIndex, endIndex);
        
        return {
          data: paginatedData,
          total: total,
          page: page,
          pageSize: pageSize,
          totalPages: Math.ceil(total / pageSize)
        };
      }
      
      // 페이징 옵션이 없으면 정렬된 배열 반환
      return formatted;
    }
    
    log('ERROR', 'getMyRequests: Invalid result format: ' + typeof result);
    return [];
  } catch (error) {
    log('ERROR', 'getMyRequests error: ' + error);
    return [];
  }
}

/**
 * 새로운 부품 발주 신청을 생성합니다.
 * @param {Object} formData - 신청 데이터 (품명, 수량, 관리번호, 사진 등)
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, requestNo: string, message: string}
 */
function createRequest(formData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      log('ERROR', 'createRequest: User not found');
      return {
        success: false,
        message: '로그인이 필요합니다.'
      };
    }
    
    const service = new RequestService();
    const result = service.createRequest(formData, user);
    
    // result가 객체인지 확인
    if (!result || typeof result !== 'object') {
      log('ERROR', 'createRequest: Invalid result from service: ' + typeof result);
      return {
        success: false,
        message: '신청 처리 중 오류가 발생했습니다.'
      };
    }
    
    // 캐시 무효화 (신청 생성 시)
    if (result.success) {
      const cacheManager = new CacheManager();
      // 관련 캐시 제거
      cacheManager.remove('request_stats_' + user.userId);
      cacheManager.remove('my_requests_' + user.userId);
      // getAllRequests 캐시는 패턴 매칭이 어려우므로 TTL에 의존
    }
    
    return result;
  } catch (error) {
    log('ERROR', 'createRequest error: ' + error);
    return {
      success: false,
      message: error.message || '신청 처리 중 오류가 발생했습니다.',
      technical: error.toString()
    };
  }
}

/**
 * 사용자의 신청 통계를 조회합니다.
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 통계 객체 {requested, inProgress, completed, total}
 */
function getRequestStats(sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      log('ERROR', 'getRequestStats: User not found');
      return { requested: 0, inProgress: 0, completed: 0, total: 0 };
    }
    
    // 캐시 확인
    const cacheManager = new CacheManager();
    const cacheKey = 'request_stats_' + user.userId;
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const requestModel = new RequestModel();
    
    // 시트 존재 여부 확인
    if (!requestModel.sheet) {
      log('WARN', 'getRequestStats: Request sheet not found');
      return { requested: 0, inProgress: 0, completed: 0, total: 0 };
    }
    
    const requests = requestModel.findAll({ requesterUserId: user.userId });
    
    // requests가 배열이 아닌 경우 처리
    if (!Array.isArray(requests)) {
      log('ERROR', 'getRequestStats: findAll returned non-array: ' + typeof requests);
      return { requested: 0, inProgress: 0, completed: 0, total: 0 };
    }
    
    const stats = {
      requested: 0,
      inProgress: 0,
      completed: 0,
      total: requests.length
    };
    
    requests.forEach(req => {
      // 접수취소 상태는 카운트에서 제외
      if (req.status === CONFIG.STATUS.CANCELLED) {
        return;
      }
      
      if (req.status === CONFIG.STATUS.REQUESTED) {
        stats.requested++;
      } else if (req.status === CONFIG.STATUS.ORDERING || 
                 req.status === CONFIG.STATUS.COMPLETED_CONFIRMED || 
                 req.status === CONFIG.STATUS.COMPLETED_PENDING) {
        stats.inProgress++;
      } else if (req.status === CONFIG.STATUS.FINISHED) {
        stats.completed++;
      }
    });
    
    // 캐시 저장 (TTL: 60초)
    cacheManager.set(cacheKey, stats, 60);
    
    return stats;
  } catch (error) {
    log('ERROR', 'getRequestStats error: ' + error);
    return { requested: 0, inProgress: 0, completed: 0, total: 0 };
  }
}

/**
 * 사용자의 알림을 조회합니다.
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 알림 배열
 */
function getNotifications(sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      log('ERROR', 'getNotifications: User not found');
      return [];
    }
    
    // 현재는 간단한 알림 로직: 사용자의 신청 중 상태 변경된 것들
    const requestModel = new RequestModel();
    
    // 시트 존재 여부 확인
    if (!requestModel.sheet) {
      log('WARN', 'getNotifications: Request sheet not found');
      return [];
    }
    
    const requests = requestModel.findAll({ requesterUserId: user.userId });
    
    // requests가 배열이 아닌 경우 처리
    if (!Array.isArray(requests)) {
      log('ERROR', 'getNotifications: findAll returned non-array: ' + typeof requests);
      return [];
    }
    
    const notifications = [];
    
    // 최근 7일 이내 상태가 변경된 신청들
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    requests.forEach(req => {
      // 최근 7일 이내 상태가 변경된 신청들에 대해 알림 생성
      if (req.lastModifiedDate && new Date(req.lastModifiedDate) > sevenDaysAgo) {
        // 상태별 알림 메시지 생성
        let notification = null;
        
        if (req.status === CONFIG.STATUS.ORDERING) {
          notification = {
            type: 'info',
            title: '발주 진행',
            message: `[${req.requestNo}] ${req.itemName} 발주가 진행 중입니다.`,
            date: req.lastModifiedDate,
            requestNo: req.requestNo
          };
        } else if (req.status === CONFIG.STATUS.COMPLETED_CONFIRMED) {
          notification = {
            type: 'success',
            title: '발주 완료',
            message: `[${req.requestNo}] ${req.itemName} 발주가 완료되었습니다. (납기확인) 수령 확인해주세요.`,
            date: req.lastModifiedDate,
            requestNo: req.requestNo
          };
        } else if (req.status === CONFIG.STATUS.COMPLETED_PENDING) {
          notification = {
            type: 'success',
            title: '발주 완료',
            message: `[${req.requestNo}] ${req.itemName} 발주가 완료되었습니다. (납기미정)`,
            date: req.lastModifiedDate,
            requestNo: req.requestNo
          };
        } else if (req.status === CONFIG.STATUS.FINISHED) {
          notification = {
            type: 'success',
            title: '처리 완료',
            message: `[${req.requestNo}] ${req.itemName} 신청 처리가 완료되었습니다.`,
            date: req.lastModifiedDate,
            requestNo: req.requestNo
          };
        } else if (req.status === CONFIG.STATUS.CANCELLED) {
          notification = {
            type: 'warning',
            title: '신청 취소',
            message: `[${req.requestNo}] ${req.itemName} 신청이 취소되었습니다.`,
            date: req.lastModifiedDate,
            requestNo: req.requestNo
          };
        }
        
        if (notification) {
          notifications.push(notification);
        }
      }
    });
    
    return notifications.slice(0, 10); // 최대 10개
  } catch (error) {
    Logger.log('getNotifications error: ' + error);
    Logger.log('getNotifications error stack: ' + error.stack);
    return []; // 에러 발생 시 빈 배열 반환
  }
}

/**
 * 수령 확인
 * @param {string} requestNo - 신청번호
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function confirmReceipt(requestNo, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }
    
    const service = new RequestService();
    return service.updateStatus(requestNo, CONFIG.STATUS.FINISHED, '신청자 수령 확인', user);
  } catch (error) {
    Logger.log('confirmReceipt error: ' + error);
    return ErrorHandler.handle(error, 'confirmReceipt');
  }
}

/**
 * 접수중인 신청을 취소합니다.
 * @param {string} requestNo - 신청번호
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function cancelRequest(requestNo, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }
    
    const service = new RequestService();
    return service.updateStatus(requestNo, CONFIG.STATUS.CANCELLED, '신청자 취소', user);
  } catch (error) {
    Logger.log('cancelRequest error: ' + error);
    return ErrorHandler.handle(error, 'cancelRequest');
  }
}

// ==========================================
// 관리자 API
// ==========================================

/**
 * 전체 신청 목록을 조회합니다. (관리자 전용)
 * @param {Object} filter - 필터 옵션 (status, region, dateFrom, dateTo 등)
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 신청 목록 배열
 */
function getAllRequests(filter = {}, sessionToken) {
  try {
    log('DEBUG', 'getAllRequests: START');
    
    const user = getCurrentUser(sessionToken);
    if (!user) {
      log('ERROR', 'getAllRequests: No user found');
      return [];
    }
    
    if (user.role !== CONFIG.ROLES.ADMIN) {
      log('ERROR', 'getAllRequests: Not admin, role = ' + user.role);
      return [];
    }
    
    // 캐시 키 생성 (필터 및 페이징 정보 포함)
    const cacheKey = 'all_requests_' + JSON.stringify({
      status: filter.status || '',
      region: filter.region || '',
      dateFrom: filter.dateFrom || '',
      dateTo: filter.dateTo || '',
      page: filter.page || 1,
      pageSize: filter.pageSize || CONFIG.PAGE_SIZE
    });
    
    const cacheManager = new CacheManager();
    
    // 캐시 확인 (TTL: 60초)
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      log('DEBUG', 'getAllRequests: Using cache');
      return cached;
    }
    
    const requestModel = new RequestModel();
    if (!requestModel.sheet) {
      log('WARN', 'getAllRequests: Request sheet not found');
      return [];
    }
    
    // 서버 측 필터링 및 페이징 옵션
    const serverFilter = {
      status: filter.status,
      region: filter.region,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo
    };
    
    const options = {
      page: filter.page || 1,
      pageSize: filter.pageSize || CONFIG.PAGE_SIZE,
      sortBy: filter.sortBy || 'requestDate',
      sortOrder: filter.sortOrder || 'desc'
    };
    
    log('DEBUG', 'getAllRequests: Calling findAll with server filter and pagination');
    const result = requestModel.findAll(serverFilter, options);
    
    // 결과가 페이징 형식인지 확인
    let requests;
    if (result && result.data && Array.isArray(result.data)) {
      requests = result.data;
    } else if (Array.isArray(result)) {
      requests = result;
    } else {
      log('ERROR', 'getAllRequests: Invalid result format');
      return [];
    }
    
    if (!requests || requests.length === 0) {
      log('DEBUG', 'getAllRequests: No requests found');
      return [];
    }
    
    // 프론트엔드용 포맷팅
    const formatDateField = function(dateValue) {
      if (!dateValue) return '';
      try {
        if (dateValue instanceof Date) {
          return Utilities.formatDate(dateValue, 'Asia/Seoul', 'yyyy. M. d a hh:mm:ss');
        }
        return String(dateValue);
      } catch (e) {
        return String(dateValue);
      }
    };
    
    const formatted = requests.map((req, index) => {
      try {
        return {
          rowIndex: req._rowIndex,
          requestNo: req.requestNo,
          requestDate: formatDateField(req.requestDate),
          requester: req.requesterName,
          requesterName: req.requesterName,
          requesterEmail: req.requesterEmail,
          team: req.team,
          region: req.region,
          itemName: req.itemName,
          modelName: req.modelName,
          serialNo: req.serialNo,
          quantity: req.quantity,
          assetNo: req.assetNo,
          deliveryPlace: req.deliveryPlace,
          phone: req.phone,
          company: req.company,
          remarks: req.remarks,
          status: req.status,
          handler: req.handler || '',
          photoUrl: req.photoUrl,
          handlerRemarks: req.handlerRemarks || '',
          orderDate: formatDateField(req.orderDate),
          expectedDeliveryDate: formatDateField(req.expectedDeliveryDate),
          receiptDate: formatDateField(req.receiptDate),
          completedDate: formatDateField(req.receiptDate || req.orderDate)
        };
      } catch (formatError) {
        log('ERROR', 'getAllRequests: Format error for request ' + index + ': ' + formatError);
        return null;
      }
    }).filter(r => r !== null);
    
    // 반환 직전 확인
    if (!formatted || !Array.isArray(formatted)) {
      log('ERROR', 'getAllRequests: formatted is not an array!');
      return [];
    }
    
    // 캐시 저장 (TTL: 60초)
    cacheManager.set(cacheKey, formatted, 60);
    
    log('DEBUG', 'getAllRequests: SUCCESS - Returning ' + formatted.length + ' items');
    return formatted;
  } catch (error) {
    log('ERROR', 'getAllRequests: EXCEPTION - ' + error.toString());
    return [];
  }
}

/**
 * 신청 건에 담당자를 배정합니다. (관리자 전용)
 * @param {string} requestNo - 신청번호
 * @param {string} handlerEmail - 담당자 이메일
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function assignHandler(requestNo, handlerEmail, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 배정할 수 있습니다.');
    }
    
    const requestModel = new RequestModel();
    const handler = new UserModel().findByEmail(handlerEmail);
    
    if (!handler) {
      throw new Error('담당자를 찾을 수 없습니다.');
    }
    
    const result = requestModel.update(requestNo, {
      handler: handler.name,
      lastModified: new Date(),
      lastModifiedBy: user.userId
    });
    
    if (result) {
      new LogService().log('담당자 배정: ' + handler.name, requestNo, user.userId);
      return { success: true, message: '담당자가 배정되었습니다.' };
    } else {
      throw new Error('신청 건을 찾을 수 없습니다.');
    }
  } catch (error) {
    Logger.log('assignHandler error: ' + error);
    return ErrorHandler.handle(error, 'assignHandler');
  }
}

/**
 * 신청 건의 상태를 변경합니다.
 * @param {string} requestNo - 신청번호
 * @param {string} newStatus - 새로운 상태
 * @param {string} remarks - 담당자 비고 (선택사항)
 * @param {string} sessionToken - 세션 토큰
 * @param {string} handler - 담당자 (선택사항)
 * @param {string} expectedDeliveryDate - 예상납기일 (선택사항)
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function updateRequestStatus(requestNo, newStatus, remarks, sessionToken, handler, expectedDeliveryDate, requesterRemarks) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 변경할 수 있습니다.');
    }
    
    const service = new RequestService();
    const result = service.updateStatus(requestNo, newStatus, remarks, user);
    
    // 추가 업데이트 (handler, expectedDeliveryDate, requesterRemarks)
    if (result.success) {
      const requestModel = new RequestModel();
      const updates = {};
      
      if (handler) {
        updates.handler = handler;
      }
      
      if (expectedDeliveryDate) {
        updates.expectedDeliveryDate = expectedDeliveryDate;
      }
      
      if (requesterRemarks !== undefined) {
        updates.remarks = requesterRemarks;
      }
      
      if (Object.keys(updates).length > 0) {
        updates.lastModified = new Date();
        updates.lastModifiedBy = user.userId;
        requestModel.update(requestNo, updates);
      }
      
      // 캐시 무효화 (상태 변경 시)
      const cacheManager = new CacheManager();
      // 신청 건 조회 캐시 제거
      cacheManager.remove('request_' + requestNo);
      // getAllRequests 캐시는 TTL에 의존 (패턴 매칭 어려움)
      // 통계 캐시는 사용자별로 관리되므로 해당 사용자 캐시만 제거
      const request = requestModel.findById(requestNo);
      if (request && request.requesterEmail) {
        cacheManager.remove('request_stats_' + request.requesterEmail);
        cacheManager.remove('my_requests_' + request.requesterEmail);
      }
    }
    
    return result;
  } catch (error) {
    log('ERROR', 'updateRequestStatus error: ' + error);
    return ErrorHandler.handle(error, 'updateRequestStatus');
  }
}

/**
 * 신청자 비고를 업데이트합니다. (신청자 본인 또는 관리자만 가능)
 * @param {string} requestNo - 신청번호
 * @param {string} requesterRemarks - 신청자 비고
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function updateRequesterRemarks(requestNo, requesterRemarks, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }
    
    const requestModel = new RequestModel();
    const request = requestModel.findById(requestNo);
    
    if (!request) {
      throw new Error('신청 건을 찾을 수 없습니다.');
    }
    
    // 권한 체크: 신청자 본인 또는 관리자만 가능
    const requestUserId = String(request.requesterEmail || '').trim();
    const currentUserId = String(user.userId || '').trim();
    const isRequester = requestUserId === currentUserId;
    const isAdmin = user.role === CONFIG.ROLES.ADMIN;
    
    if (!isRequester && !isAdmin) {
      throw new Error('신청자 본인 또는 관리자만 변경할 수 있습니다.');
    }
    
    const updates = {
      remarks: requesterRemarks || '',
      lastModified: new Date(),
      lastModifiedBy: user.userId
    };
    
    requestModel.update(requestNo, updates);
    
    // 캐시 무효화
    const cacheManager = new CacheManager();
    cacheManager.remove('request_' + requestNo);
    if (request.requesterEmail) {
      cacheManager.remove('request_stats_' + request.requesterEmail);
      cacheManager.remove('my_requests_' + request.requesterEmail);
    }
    
    new LogService().log('신청자 비고 업데이트', requestNo, user.userId);
    
    return { 
      success: true, 
      message: '신청자 비고가 저장되었습니다.' 
    };
  } catch (error) {
    log('ERROR', 'updateRequesterRemarks error: ' + error);
    return ErrorHandler.handle(error, 'updateRequesterRemarks');
  }
}

/**
 * 접수 담당자 비고를 업데이트합니다. (접수 담당자 또는 관리자만 가능)
 * @param {string} requestNo - 신청번호
 * @param {string} handlerRemarks - 접수 담당자 비고
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function updateHandlerRemarks(requestNo, handlerRemarks, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }
    
    const requestModel = new RequestModel();
    const request = requestModel.findById(requestNo);
    
    if (!request) {
      throw new Error('신청 건을 찾을 수 없습니다.');
    }
    
    // 권한 체크: 접수 담당자 또는 관리자만 가능
    const isAdmin = user.role === CONFIG.ROLES.ADMIN;
    const isHandler = request.handler && request.handler === user.userId;
    
    if (!isHandler && !isAdmin) {
      throw new Error('접수 담당자 또는 관리자만 변경할 수 있습니다.');
    }
    
    const updates = {
      handlerRemarks: handlerRemarks || '',
      lastModified: new Date(),
      lastModifiedBy: user.userId
    };
    
    requestModel.update(requestNo, updates);
    
    // 캐시 무효화
    const cacheManager = new CacheManager();
    cacheManager.remove('request_' + requestNo);
    if (request.requesterEmail) {
      cacheManager.remove('request_stats_' + request.requesterEmail);
      cacheManager.remove('my_requests_' + request.requesterEmail);
    }
    
    new LogService().log('접수 담당자 비고 업데이트', requestNo, user.userId);
    
    return { 
      success: true, 
      message: '접수 담당자 비고가 저장되었습니다.' 
    };
  } catch (error) {
    log('ERROR', 'updateHandlerRemarks error: ' + error);
    return ErrorHandler.handle(error, 'updateHandlerRemarks');
  }
}

/**
 * 여러 신청 건의 상태를 일괄 변경합니다. (관리자 전용)
 * @param {Array<string>} requestNos - 신청번호 배열
 * @param {string} newStatus - 새로운 상태
 * @param {string} remarks - 담당자 비고 (선택사항)
 * @return {Object} 결과 객체 {success: boolean, message: string, results: Object}
 */
function bulkUpdateStatus(requestNos, newStatus, remarks, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    const results = {
      success: [],
      failed: []
    };
    
    requestNos.forEach(requestNo => {
      try {
        const service = new RequestService();
        const result = service.updateStatus(requestNo, newStatus, remarks, user);
        if (result.success) {
          results.success.push(requestNo);
        } else {
          results.failed.push({ requestNo, error: result.message });
        }
      } catch (error) {
        results.failed.push({ requestNo, error: error.message });
      }
    });
    
    return {
      success: true,
      message: `${results.success.length}건이 처리되었습니다.`,
      results: results
    };
  } catch (error) {
    Logger.log('bulkUpdateStatus error: ' + error);
    return ErrorHandler.handle(error, 'bulkUpdateStatus');
  }
}

// ==========================================
// 공통 API
// ==========================================

/**
 * 대시보드 데이터를 배치로 조회합니다. (성능 최적화)
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 대시보드 데이터 객체 {success, stats, recentRequests, notifications}
 */
function getDashboardData(sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    
    // 병렬 조회
    const [stats, recentRequests, notifications] = [
      getRequestStats(sessionToken),
      getMyRequests({ limit: 5 }, sessionToken),
      getNotifications(sessionToken)
    ];
    
    return {
      success: true,
      stats: stats || { requested: 0, inProgress: 0, completed: 0, total: 0 },
      recentRequests: Array.isArray(recentRequests) ? recentRequests : [],
      notifications: Array.isArray(notifications) ? notifications : []
    };
  } catch (error) {
    log('ERROR', 'getDashboardData error: ' + error);
    return { success: false, error: error.toString() };
  }
}

/**
 * 코드 목록을 조회합니다. (지역, 소속팀, 상태 등)
 * @param {string} type - 코드 타입 ('region', 'team', 'status') 또는 undefined (전체)
 * @return {Object|Array} 코드 목록 객체 또는 배열
 */
function getCodeList(type) {
  try {
    const cacheManager = new CacheManager();
    const cacheKey = 'codes_' + (type || 'all');
    
    // 캐시 확인 (코드는 자주 변경되지 않음, TTL: 10분)
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      log('DEBUG', 'getCodeList: Using cache for type: ' + (type || 'all'));
      return cached;
    }
    
    const codeModel = new CodeModel();
    let result;
    
    switch (type) {
      case 'region':
        result = codeModel.getRegions();
        break;
      case 'team':
        result = codeModel.getTeams();
        break;
      case 'status':
        result = codeModel.getStatusList();
        break;
      default:
        result = {
          regions: codeModel.getRegions(),
          teams: codeModel.getTeams(),
          statuses: codeModel.getStatusList()
        };
    }
    
    // 캐시 저장 (TTL: 10분 = 600초)
    cacheManager.set(cacheKey, result, 600);
    
    return result;
  } catch (error) {
    log('ERROR', 'getCodeList error: ' + error);
    return ErrorHandler.handle(error, 'getCodeList');
  }
}

/**
 * 모든 배송지 목록을 조회합니다. (관리자 전용)
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 배송지 목록
 */
function getAllDeliveryPlaces(sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // CONFIG 누락/캐시 이슈 대비 fallback
    const sheetName = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.DELIVERY_PLACES)
      ? String(CONFIG.SHEETS.DELIVERY_PLACES).trim()
      : '배송지관리';
    
    const sheet = getSheetByNameLoose_(ss, sheetName);
    if (!sheet) return [];
    
    // 관리자 페이지에서는 활성화 여부와 관계없이 모든 배송지 조회
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    const allPlaces = rows
      .filter(row => {
        // 배송지명이 있는 행만
        const 배송지명Index = headers.indexOf('배송지명');
        return 배송지명Index >= 0 && row[배송지명Index] && row[배송지명Index].toString().trim() !== '';
      })
      .map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
    
    // 객체 배열로 변환
    return allPlaces.map(place => ({
      '배송지명': place['배송지명'] || '',
      '소속팀': place['소속팀'] || '',
      '주소': place['주소'] || '',
      '연락처': place['연락처'] || '',
      '담당자': place['담당자'] || '',
      '활성화': place['활성화'] || 'Y',
      '비고': place['비고'] || ''
    }));
  } catch (error) {
    Logger.log('getAllDeliveryPlaces error: ' + error);
    Logger.log('getAllDeliveryPlaces error stack: ' + error.stack);
    return [];
  }
}


/**
 * 전체 사용자 조회 (관리자 전용)
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 사용자 목록
 */
function getAllUsers(sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      log('ERROR', 'getAllUsers: Not admin');
      return [];
    }
    
    const userModel = new UserModel();
    if (!userModel.sheet) {
      log('WARN', 'getAllUsers: Users sheet not found');
      return [];
    }
    
    const data = userModel.sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const userIdCol = headers.indexOf('사용자ID');
    const nameCol = headers.indexOf('이름');
    const employeeCodeCol = headers.indexOf('기사코드');
    const teamCol = headers.indexOf('소속팀');
    const regionCol = headers.indexOf('지역');
    const roleCol = headers.indexOf('역할');
    const activeCol = headers.indexOf('활성화');
    
    if (userIdCol < 0) {
      log('ERROR', 'getAllUsers: 사용자ID 컬럼을 찾을 수 없습니다.');
      return [];
    }
    
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[userIdCol] || String(row[userIdCol]).trim() === '') continue;
      
      users.push({
        userId: row[userIdCol],
        name: nameCol >= 0 ? row[nameCol] : '',
        employeeCode: employeeCodeCol >= 0 ? row[employeeCodeCol] : '',
        team: teamCol >= 0 ? row[teamCol] : '',
        region: regionCol >= 0 ? row[regionCol] : '',
        role: roleCol >= 0 ? row[roleCol] : '',
        active: activeCol >= 0 ? row[activeCol] : 'Y'
      });
    }
    
    return users;
  } catch (error) {
    log('ERROR', 'getAllUsers error: ' + error);
    return [];
  }
}

/**
 * 사용자 등록 (관리자 전용)
 * @param {Object} userData - 사용자 데이터 {userId, password, name, employeeCode, team, region, role, active}
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function createUser(userData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!userData.userId) {
      throw new Error('사용자ID가 필요합니다.');
    }
    
    const userModel = new UserModel();
    if (!userModel.sheet) {
      throw new Error('사용자 시트를 찾을 수 없습니다.');
    }
    
    // 중복 체크
    const existingUser = userModel.findByUserId(userData.userId);
    if (existingUser) {
      throw new Error('이미 존재하는 사용자ID입니다.');
    }
    
    // 헤더 확인 및 생성
    const data = userModel.sheet.getDataRange().getValues();
    if (data.length === 0) {
      userModel.sheet.getRange(1, 1, 1, 9).setValues([[
        '사용자ID', '비밀번호해시', '비밀번호', '이름', '기사코드', '소속팀', '지역', '역할', '활성화'
      ]]);
    }
    
    // 헤더 확인 및 '비밀번호' 컬럼 추가 (없으면)
    const headers = data.length > 0 ? data[0] : [];
    const passwordCol = headers.indexOf('비밀번호');
    if (passwordCol < 0 && data.length > 0) {
      // '비밀번호해시' 다음에 '비밀번호' 컬럼 추가
      const passwordHashCol = headers.indexOf('비밀번호해시');
      if (passwordHashCol >= 0) {
        userModel.sheet.insertColumnAfter(passwordHashCol + 1);
        userModel.sheet.getRange(1, passwordHashCol + 2).setValue('비밀번호');
        // 헤더 다시 읽기
        const newData = userModel.sheet.getDataRange().getValues();
        headers.length = 0;
        headers.push(...newData[0]);
      }
    }
    
    // 비밀번호 해시 생성
    const passwordHash = userData.password ? hashPassword(userData.password) : '';
    // 평문 비밀번호 (passwordPlain이 있으면 사용, 없으면 password 사용)
    const passwordPlain = userData.passwordPlain || userData.password || '';
    
    // 헤더 인덱스 찾기
    const finalHeaders = userModel.sheet.getDataRange().getValues()[0];
    const userIdCol = finalHeaders.indexOf('사용자ID');
    const passwordHashCol = finalHeaders.indexOf('비밀번호해시');
    const passwordPlainCol = finalHeaders.indexOf('비밀번호');
    const nameCol = finalHeaders.indexOf('이름');
    const employeeCodeCol = finalHeaders.indexOf('기사코드');
    const teamCol = finalHeaders.indexOf('소속팀');
    const regionCol = finalHeaders.indexOf('지역');
    const roleCol = finalHeaders.indexOf('역할');
    const activeCol = finalHeaders.indexOf('활성화');
    
    // 새 행 생성 (모든 컬럼에 맞춰서)
    const maxCol = Math.max(userIdCol, passwordHashCol, passwordPlainCol, nameCol, employeeCodeCol, teamCol, regionCol, roleCol, activeCol) + 1;
    const newRow = new Array(maxCol).fill('');
    
    if (userIdCol >= 0) newRow[userIdCol] = userData.userId;
    if (passwordHashCol >= 0) newRow[passwordHashCol] = passwordHash;
    if (passwordPlainCol >= 0) newRow[passwordPlainCol] = passwordPlain;
    if (nameCol >= 0) newRow[nameCol] = userData.name || '';
    if (employeeCodeCol >= 0) newRow[employeeCodeCol] = userData.employeeCode || '';
    if (teamCol >= 0) newRow[teamCol] = userData.team || '';
    if (regionCol >= 0) newRow[regionCol] = userData.region || '';
    if (roleCol >= 0) newRow[roleCol] = userData.role || '신청자';
    if (activeCol >= 0) newRow[activeCol] = userData.active || 'Y';
    
    userModel.sheet.appendRow(newRow);
    
    new LogService().log('사용자 등록', null, user.userId, userData.userId);
    
    return {
      success: true,
      message: '사용자가 등록되었습니다.'
    };
  } catch (error) {
    log('ERROR', 'createUser error: ' + error);
    return {
      success: false,
      message: error.message || '사용자 등록 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 사용자 수정 (관리자 전용)
 * @param {string} userId - 사용자 ID
 * @param {Object} userData - 수정할 사용자 데이터 {name, employeeCode, team, region, role, active, password}
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function updateUser(userId, userData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!userId) {
      throw new Error('사용자ID가 필요합니다.');
    }
    
    const userModel = new UserModel();
    if (!userModel.sheet) {
      throw new Error('사용자 시트를 찾을 수 없습니다.');
    }
    
    const existingUser = userModel.findByUserId(userId);
    if (!existingUser) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const data = userModel.sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('사용자 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const userIdCol = headers.indexOf('사용자ID');
    const passwordHashCol = headers.indexOf('비밀번호해시');
    let passwordPlainCol = headers.indexOf('비밀번호');
    
    // '비밀번호' 컬럼이 없으면 추가
    if (passwordPlainCol < 0) {
      if (passwordHashCol >= 0) {
        userModel.sheet.insertColumnAfter(passwordHashCol + 1);
        userModel.sheet.getRange(1, passwordHashCol + 2).setValue('비밀번호');
        // 헤더 다시 읽기
        const newData = userModel.sheet.getDataRange().getValues();
        passwordPlainCol = newData[0].indexOf('비밀번호');
        // 기존 데이터 행들에 빈 값 추가
        for (let i = 1; i < newData.length; i++) {
          const row = newData[i];
          if (row.length <= passwordPlainCol) {
            row[passwordPlainCol] = '';
          }
        }
      }
    }
    
    const nameCol = headers.indexOf('이름');
    const employeeCodeCol = headers.indexOf('기사코드');
    const teamCol = headers.indexOf('소속팀');
    const regionCol = headers.indexOf('지역');
    const roleCol = headers.indexOf('역할');
    const activeCol = headers.indexOf('활성화');
    
    const normalizedUserId = String(userId).trim();
    
    // 헤더 다시 읽기 (컬럼 추가 후)
    const finalData = userModel.sheet.getDataRange().getValues();
    const finalHeaders = finalData[0];
    const finalPasswordPlainCol = finalHeaders.indexOf('비밀번호');
    
    for (let i = 1; i < finalData.length; i++) {
      const sheetUserId = String(finalData[i][userIdCol] || '').trim();
      if (sheetUserId === normalizedUserId) {
        const rowNum = i + 1;
        
        // 비밀번호 변경이 있으면 해시 생성 및 평문 저장
        if (userData.password) {
          const newHash = hashPassword(userData.password);
          if (passwordHashCol >= 0) {
            userModel.sheet.getRange(rowNum, passwordHashCol + 1).setValue(newHash);
          }
          // 평문 비밀번호 저장 (passwordPlain이 있으면 사용, 없으면 password 사용)
          const passwordPlain = userData.passwordPlain || userData.password || '';
          if (finalPasswordPlainCol >= 0) {
            userModel.sheet.getRange(rowNum, finalPasswordPlainCol + 1).setValue(passwordPlain);
          }
        }
        
        // 다른 필드 업데이트
        if (userData.name !== undefined && nameCol >= 0) {
          userModel.sheet.getRange(rowNum, nameCol + 1).setValue(userData.name);
        }
        if (userData.employeeCode !== undefined && employeeCodeCol >= 0) {
          userModel.sheet.getRange(rowNum, employeeCodeCol + 1).setValue(userData.employeeCode);
        }
        if (userData.team !== undefined && teamCol >= 0) {
          userModel.sheet.getRange(rowNum, teamCol + 1).setValue(userData.team);
        }
        if (userData.region !== undefined && regionCol >= 0) {
          userModel.sheet.getRange(rowNum, regionCol + 1).setValue(userData.region);
        }
        if (userData.role !== undefined && roleCol >= 0) {
          userModel.sheet.getRange(rowNum, roleCol + 1).setValue(userData.role);
        }
        if (userData.active !== undefined && activeCol >= 0) {
          userModel.sheet.getRange(rowNum, activeCol + 1).setValue(userData.active);
        }
        
        new LogService().log('사용자 수정', null, user.userId, userId);
        
        return {
          success: true,
          message: '사용자 정보가 수정되었습니다.'
        };
      }
    }
    
    throw new Error('사용자를 찾을 수 없습니다.');
  } catch (error) {
    log('ERROR', 'updateUser error: ' + error);
    return {
      success: false,
      message: error.message || '사용자 수정 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 사용자 삭제 (관리자 전용)
 * @param {string} userId - 사용자 ID
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function deleteUser(userId, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!userId) {
      throw new Error('사용자ID가 필요합니다.');
    }
    
    // 자기 자신 삭제 방지
    if (userId === user.userId) {
      throw new Error('자기 자신은 삭제할 수 없습니다.');
    }
    
    const userModel = new UserModel();
    if (!userModel.sheet) {
      throw new Error('사용자 시트를 찾을 수 없습니다.');
    }
    
    const existingUser = userModel.findByUserId(userId);
    if (!existingUser) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const data = userModel.sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('사용자 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const userIdCol = headers.indexOf('사용자ID');
    const normalizedUserId = String(userId).trim();
    
    for (let i = 1; i < data.length; i++) {
      const sheetUserId = String(data[i][userIdCol] || '').trim();
      if (sheetUserId === normalizedUserId) {
        // 행 삭제
        userModel.sheet.deleteRow(i + 1);
        
        new LogService().log('사용자 삭제', null, user.userId, userId);
        
        return {
          success: true,
          message: '사용자가 삭제되었습니다.'
        };
      }
    }
    
    throw new Error('사용자를 찾을 수 없습니다.');
  } catch (error) {
    log('ERROR', 'deleteUser error: ' + error);
    return {
      success: false,
      message: error.message || '사용자 삭제 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 배송지 등록 (관리자 전용)
 * @param {Object} placeData - 배송지 데이터 {배송지명, 소속팀, 주소, 연락처, 담당자, 활성화, 비고}
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function createDeliveryPlace(placeData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!placeData['배송지명'] || String(placeData['배송지명']).trim() === '') {
      throw new Error('배송지명이 필요합니다.');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.DELIVERY_PLACES)
      ? String(CONFIG.SHEETS.DELIVERY_PLACES).trim()
      : '배송지관리';
    
    let sheet = getSheetByNameLoose_(ss, sheetName);
    
    // 시트가 없으면 생성
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, 7).setValues([[
        '배송지명', '소속팀', '주소', '연락처', '담당자', '활성화', '비고'
      ]]);
    }
    
    // 헤더 확인
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      sheet.getRange(1, 1, 1, 7).setValues([[
        '배송지명', '소속팀', '주소', '연락처', '담당자', '활성화', '비고'
      ]]);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const 배송지명Col = headers.indexOf('배송지명');
    
    // 중복 체크
    if (배송지명Col >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][배송지명Col] || '').trim() === String(placeData['배송지명']).trim()) {
          throw new Error('이미 존재하는 배송지명입니다.');
        }
      }
    }
    
    // 새 행 추가
    const newRow = [
      placeData['배송지명'] || '',
      placeData['소속팀'] || '',
      placeData['주소'] || '',
      placeData['연락처'] || '',
      placeData['담당자'] || '',
      placeData['활성화'] || 'Y',
      placeData['비고'] || ''
    ];
    
    sheet.appendRow(newRow);
    
    new LogService().log('배송지 등록', null, user.userId, placeData['배송지명']);
    
    return {
      success: true,
      message: '배송지가 등록되었습니다.'
    };
  } catch (error) {
    log('ERROR', 'createDeliveryPlace error: ' + error);
    return {
      success: false,
      message: error.message || '배송지 등록 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 배송지 수정 (관리자 전용)
 * @param {string} placeName - 배송지명 (기존)
 * @param {Object} placeData - 수정할 배송지 데이터
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function updateDeliveryPlace(placeName, placeData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!placeName) {
      throw new Error('배송지명이 필요합니다.');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.DELIVERY_PLACES)
      ? String(CONFIG.SHEETS.DELIVERY_PLACES).trim()
      : '배송지관리';
    
    const sheet = getSheetByNameLoose_(ss, sheetName);
    if (!sheet) {
      throw new Error('배송지 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('배송지 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const 배송지명Col = headers.indexOf('배송지명');
    const 소속팀Col = headers.indexOf('소속팀');
    const 주소Col = headers.indexOf('주소');
    const 연락처Col = headers.indexOf('연락처');
    const 담당자Col = headers.indexOf('담당자');
    const 활성화Col = headers.indexOf('활성화');
    const 비고Col = headers.indexOf('비고');
    
    if (배송지명Col < 0) {
      throw new Error('배송지명 컬럼을 찾을 수 없습니다.');
    }
    
    const normalizedPlaceName = String(placeName).trim();
    
    for (let i = 1; i < data.length; i++) {
      const sheetPlaceName = String(data[i][배송지명Col] || '').trim();
      if (sheetPlaceName === normalizedPlaceName) {
        const rowNum = i + 1;
        
        // 배송지명 변경 시 중복 체크
        if (placeData['배송지명'] && placeData['배송지명'] !== placeName) {
          for (let j = 1; j < data.length; j++) {
            if (j !== i && String(data[j][배송지명Col] || '').trim() === String(placeData['배송지명']).trim()) {
              throw new Error('이미 존재하는 배송지명입니다.');
            }
          }
        }
        
        // 필드 업데이트
        if (placeData['배송지명'] !== undefined && 배송지명Col >= 0) {
          sheet.getRange(rowNum, 배송지명Col + 1).setValue(placeData['배송지명']);
        }
        if (placeData['소속팀'] !== undefined && 소속팀Col >= 0) {
          sheet.getRange(rowNum, 소속팀Col + 1).setValue(placeData['소속팀']);
        }
        if (placeData['주소'] !== undefined && 주소Col >= 0) {
          sheet.getRange(rowNum, 주소Col + 1).setValue(placeData['주소']);
        }
        if (placeData['연락처'] !== undefined && 연락처Col >= 0) {
          sheet.getRange(rowNum, 연락처Col + 1).setValue(placeData['연락처']);
        }
        if (placeData['담당자'] !== undefined && 담당자Col >= 0) {
          sheet.getRange(rowNum, 담당자Col + 1).setValue(placeData['담당자']);
        }
        if (placeData['활성화'] !== undefined && 활성화Col >= 0) {
          sheet.getRange(rowNum, 활성화Col + 1).setValue(placeData['활성화']);
        }
        if (placeData['비고'] !== undefined && 비고Col >= 0) {
          sheet.getRange(rowNum, 비고Col + 1).setValue(placeData['비고']);
        }
        
        new LogService().log('배송지 수정', null, user.userId, placeName);
        
        return {
          success: true,
          message: '배송지 정보가 수정되었습니다.'
        };
      }
    }
    
    throw new Error('배송지를 찾을 수 없습니다.');
  } catch (error) {
    log('ERROR', 'updateDeliveryPlace error: ' + error);
    return {
      success: false,
      message: error.message || '배송지 수정 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 배송지 삭제 (관리자 전용)
 * @param {string} placeName - 배송지명
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function deleteDeliveryPlace(placeName, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!placeName) {
      throw new Error('배송지명이 필요합니다.');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.DELIVERY_PLACES)
      ? String(CONFIG.SHEETS.DELIVERY_PLACES).trim()
      : '배송지관리';
    
    const sheet = getSheetByNameLoose_(ss, sheetName);
    if (!sheet) {
      throw new Error('배송지 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('배송지 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const 배송지명Col = headers.indexOf('배송지명');
    
    if (배송지명Col < 0) {
      throw new Error('배송지명 컬럼을 찾을 수 없습니다.');
    }
    
    const normalizedPlaceName = String(placeName).trim();
    
    for (let i = 1; i < data.length; i++) {
      const sheetPlaceName = String(data[i][배송지명Col] || '').trim();
      if (sheetPlaceName === normalizedPlaceName) {
        // 행 삭제
        sheet.deleteRow(i + 1);
        
        new LogService().log('배송지 삭제', null, user.userId, placeName);
        
        return {
          success: true,
          message: '배송지가 삭제되었습니다.'
        };
      }
    }
    
    throw new Error('배송지를 찾을 수 없습니다.');
  } catch (error) {
    log('ERROR', 'deleteDeliveryPlace error: ' + error);
    return {
      success: false,
      message: error.message || '배송지 삭제 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 지역관리 시트에서 지역-팀 목록을 조회합니다.
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 지역-팀 목록 [{region, team, active}]
 */
function getRegionTeams(sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '지역관리';
    const sheet = getSheetByNameLoose_(ss, sheetName);
    
    if (!sheet) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }
    
    const headers = data[0];
    const regionCol = headers.indexOf('지역');
    const teamCol = headers.indexOf('팀');
    const activeCol = headers.indexOf('활성화');
    
    if (regionCol < 0 || teamCol < 0 || activeCol < 0) {
      return [];
    }
    
    const result = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const region = String(row[regionCol] || '').trim();
      const team = String(row[teamCol] || '').trim();
      const active = String(row[activeCol] || 'Y').trim().toUpperCase();
      
      if (region) {
        result.push({
          region: region,
          team: team,
          active: active === 'Y' ? 'Y' : 'N'
        });
      }
    }
    
    return result;
  } catch (error) {
    log('ERROR', 'getRegionTeams error: ' + error);
    return [];
  }
}

/**
 * 지역관리 시트에 지역-팀을 추가합니다.
 * @param {Object} regionTeamData - 지역-팀 데이터 {region, team}
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function createRegionTeam(regionTeamData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!regionTeamData.region || !regionTeamData.team) {
      throw new Error('지역과 팀이 모두 필요합니다.');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '지역관리';
    let sheet = getSheetByNameLoose_(ss, sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['지역', '팀', '활성화']);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data.length > 0 ? data[0] : ['지역', '팀', '활성화'];
    
    // 헤더가 없으면 추가
    if (data.length === 0) {
      sheet.appendRow(['지역', '팀', '활성화']);
    }
    
    // 중복 체크
    const regionCol = headers.indexOf('지역');
    const teamCol = headers.indexOf('팀');
    
    if (regionCol < 0 || teamCol < 0) {
      throw new Error('지역관리 시트의 컬럼 구조가 올바르지 않습니다.');
    }
    
    const newRegion = String(regionTeamData.region).trim();
    const newTeam = String(regionTeamData.team).trim();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const existingRegion = String(row[regionCol] || '').trim();
      const existingTeam = String(row[teamCol] || '').trim();
      
      if (existingRegion === newRegion && existingTeam === newTeam) {
        throw new Error('이미 존재하는 지역-팀 조합입니다.');
      }
    }
    
    // 새 행 추가
    sheet.appendRow([newRegion, newTeam, 'Y']);
    
    new LogService().log('지역-팀 추가', null, user.userId, newRegion + ' - ' + newTeam);
    
    return {
      success: true,
      message: '지역-팀이 추가되었습니다.'
    };
  } catch (error) {
    log('ERROR', 'createRegionTeam error: ' + error);
    return {
      success: false,
      message: error.message || '지역-팀 추가 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 지역관리 시트의 지역-팀을 수정하고, 사용자 데이터도 함께 업데이트합니다.
 * @param {Object} updateData - 수정 데이터 {oldRegion, oldTeam, newRegion, newTeam}
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function updateRegionTeam(updateData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!updateData.oldRegion || !updateData.oldTeam) {
      throw new Error('기존 지역과 팀이 필요합니다.');
    }
    
    if (!updateData.newRegion || !updateData.newTeam) {
      throw new Error('새 지역과 팀이 필요합니다.');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '지역관리';
    const sheet = getSheetByNameLoose_(ss, sheetName);
    
    if (!sheet) {
      throw new Error('지역관리 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('지역관리 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const regionCol = headers.indexOf('지역');
    const teamCol = headers.indexOf('팀');
    
    if (regionCol < 0 || teamCol < 0) {
      throw new Error('지역관리 시트의 컬럼 구조가 올바르지 않습니다.');
    }
    
    const oldRegion = String(updateData.oldRegion).trim();
    const oldTeam = String(updateData.oldTeam).trim();
    const newRegion = String(updateData.newRegion).trim();
    const newTeam = String(updateData.newTeam).trim();
    
    // 지역관리 시트에서 해당 행 찾기 및 수정
    let found = false;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const existingRegion = String(row[regionCol] || '').trim();
      const existingTeam = String(row[teamCol] || '').trim();
      
      if (existingRegion === oldRegion && existingTeam === oldTeam) {
        // 지역관리 시트 업데이트
        sheet.getRange(i + 1, regionCol + 1).setValue(newRegion);
        sheet.getRange(i + 1, teamCol + 1).setValue(newTeam);
        found = true;
        break;
      }
    }
    
    if (!found) {
      throw new Error('수정할 지역-팀을 찾을 수 없습니다.');
    }
    
    // 사용자 데이터 업데이트
    const userModel = new UserModel();
    if (userModel.sheet) {
      const userData = userModel.sheet.getDataRange().getValues();
      if (userData.length > 1) {
        const userHeaders = userData[0];
        const userRegionCol = userHeaders.indexOf('지역');
        const userTeamCol = userHeaders.indexOf('소속팀');
        
        if (userRegionCol >= 0 && userTeamCol >= 0) {
          let updatedCount = 0;
          for (let i = 1; i < userData.length; i++) {
            const userRow = userData[i];
            const userRegion = String(userRow[userRegionCol] || '').trim();
            const userTeam = String(userRow[userTeamCol] || '').trim();
            
            if (userRegion === oldRegion && userTeam === oldTeam) {
              userModel.sheet.getRange(i + 1, userRegionCol + 1).setValue(newRegion);
              userModel.sheet.getRange(i + 1, userTeamCol + 1).setValue(newTeam);
              updatedCount++;
            }
          }
          
          if (updatedCount > 0) {
            Logger.log('updateRegionTeam: ' + updatedCount + '명의 사용자 데이터가 업데이트되었습니다.');
          }
        }
      }
    }
    
    new LogService().log('지역-팀 수정', null, user.userId, oldRegion + '-' + oldTeam + ' -> ' + newRegion + '-' + newTeam);
    
    return {
      success: true,
      message: '지역-팀이 수정되었습니다.'
    };
  } catch (error) {
    log('ERROR', 'updateRegionTeam error: ' + error);
    return {
      success: false,
      message: error.message || '지역-팀 수정 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 지역관리 시트의 지역-팀을 비활성화합니다.
 * 지역을 삭제하면 해당 지역의 모든 팀도 비활성화됩니다.
 * @param {Object} deleteData - 삭제 데이터 {region, team, deleteRegion}
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function deleteRegionTeam(deleteData, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '지역관리';
    const sheet = getSheetByNameLoose_(ss, sheetName);
    
    if (!sheet) {
      throw new Error('지역관리 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('지역관리 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const regionCol = headers.indexOf('지역');
    const teamCol = headers.indexOf('팀');
    const activeCol = headers.indexOf('활성화');
    
    if (regionCol < 0 || teamCol < 0 || activeCol < 0) {
      throw new Error('지역관리 시트의 컬럼 구조가 올바르지 않습니다.');
    }
    
    // 헤더가 없으면 추가
    if (activeCol < 0) {
      sheet.getRange(1, headers.length + 1).setValue('활성화');
      const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newActiveCol = newHeaders.indexOf('활성화');
      if (newActiveCol >= 0) {
        // 기존 데이터의 활성화 컬럼을 Y로 설정
        for (let i = 2; i <= data.length; i++) {
          sheet.getRange(i, newActiveCol + 1).setValue('Y');
        }
      }
    }
    
    const targetRegion = String(deleteData.region || '').trim();
    const targetTeam = String(deleteData.team || '').trim();
    const deleteRegion = deleteData.deleteRegion === true; // 지역 전체 삭제 여부
    
    let updatedCount = 0;
    
    if (deleteRegion && targetRegion) {
      // 지역 전체 삭제: 해당 지역의 모든 팀 비활성화
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const existingRegion = String(row[regionCol] || '').trim();
        
        if (existingRegion === targetRegion) {
          sheet.getRange(i + 1, activeCol + 1).setValue('N');
          updatedCount++;
        }
      }
      
      new LogService().log('지역 삭제', null, user.userId, targetRegion);
      
      return {
        success: true,
        message: targetRegion + ' 지역과 모든 팀이 비활성화되었습니다. (' + updatedCount + '건)'
      };
    } else if (targetRegion && targetTeam) {
      // 특정 팀만 삭제
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const existingRegion = String(row[regionCol] || '').trim();
        const existingTeam = String(row[teamCol] || '').trim();
        
        if (existingRegion === targetRegion && existingTeam === targetTeam) {
          sheet.getRange(i + 1, activeCol + 1).setValue('N');
          updatedCount = 1;
          break;
        }
      }
      
      if (updatedCount === 0) {
        throw new Error('삭제할 지역-팀을 찾을 수 없습니다.');
      }
      
      new LogService().log('지역-팀 삭제', null, user.userId, targetRegion + ' - ' + targetTeam);
      
      return {
        success: true,
        message: '지역-팀이 비활성화되었습니다.'
      };
    } else {
      throw new Error('지역과 팀 정보가 필요합니다.');
    }
  } catch (error) {
    log('ERROR', 'deleteRegionTeam error: ' + error);
    return {
      success: false,
      message: error.message || '지역-팀 삭제 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 배송지 목록을 조회합니다.
 * 사용자의 소속팀을 기반으로 파트별 배송지를 매핑하여 반환합니다.
 * @param {string} team - 소속팀 (선택사항, 파트별 필터링)
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 배송지 목록
 */
function getDeliveryPlaces(team, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      Logger.log('getDeliveryPlaces: User not found');
      return []; // 빈 배열 반환
    }
    
    // 사용자의 소속팀을 우선 사용, 없으면 파라미터 사용
    const userTeam = user.team || team;
    
    // 파트별 배송지 매핑 로직 사용
    const places = getDeliveryPlacesByTeam(userTeam, sessionToken);
    
    // places가 배열이 아닌 경우 처리
    if (!Array.isArray(places)) {
      Logger.log('getDeliveryPlaces: getDeliveryPlacesByTeam returned non-array: ' + typeof places);
      return []; // 빈 배열 반환
    }
    
    return places;
  } catch (error) {
    Logger.log('getDeliveryPlaces error: ' + error);
    Logger.log('getDeliveryPlaces error stack: ' + error.stack);
    return []; // 에러 발생 시 빈 배열 반환
  }
}

/**
 * 신청 건의 상세 정보를 조회합니다.
 * @param {string} requestNo - 신청번호
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 신청 상세 정보 객체
 */
function getRequest(requestNo, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      Logger.log('getRequest: User not found');
      throw new Error('로그인이 필요합니다.');
    }
    
    const requestModel = new RequestModel();
    
    // 시트 존재 여부 확인
    if (!requestModel.sheet) {
      Logger.log('getRequest: Request sheet not found');
      throw new Error('신청 시트를 찾을 수 없습니다.');
    }
    
    const request = requestModel.findById(requestNo);
    
    if (!request) {
      Logger.log('getRequest: Request not found for requestNo: ' + requestNo);
      throw new Error('신청 건을 찾을 수 없습니다.');
    }
    
    // request 객체의 필드 확인 (디버깅)
    Logger.log('getRequest - request object keys: ' + Object.keys(request).join(', '));
    Logger.log('getRequest - requesterName: ' + request.requesterName);
    Logger.log('getRequest - team: ' + request.team);
    Logger.log('getRequest - employeeCode: ' + request.employeeCode);
    Logger.log('getRequest - requesterEmail: ' + request.requesterEmail);
    Logger.log('getRequest - Current user userId: ' + user.userId);
    
    // 권한 체크 (requesterEmail과 userId 비교 시 정규화)
    const requestUserId = String(request.requesterEmail || '').trim();
    const currentUserId = String(user.userId || '').trim();
    
    if (user.role !== CONFIG.ROLES.ADMIN && requestUserId !== currentUserId) {
      Logger.log('getRequest: Permission denied. requestUserId: ' + requestUserId + ', currentUserId: ' + currentUserId);
      throw new Error('조회 권한이 없습니다.');
    }
    
    return {
      rowIndex: request._rowIndex,
      requestNo: request.requestNo ? String(request.requestNo) : '',
      requestDate: request.requestDate ? String(request.requestDate) : '',
      requesterEmail: request.requesterEmail || '',
      requesterName: request.requesterName || '',
      employeeCode: request.employeeCode || '', // requesterCode -> employeeCode로 수정
      team: request.team || '',
      region: request.region || '',
      itemName: request.itemName || '',
      modelName: request.modelName || '',
      serialNo: request.serialNo || '',
      quantity: request.quantity || 0,
      assetNo: request.assetNo || '',
      deliveryPlace: request.deliveryPlace || '',
      phone: request.phone || '',
      company: request.company || '',
      remarks: request.remarks || '',
      photoUrl: request.photoUrl || '',
      status: request.status || '',
      handler: request.handler || '',
      handlerRemarks: request.handlerRemarks || '',
      orderDate: request.orderDate ? String(request.orderDate) : '',
      expectedDeliveryDate: request.expectedDeliveryDate ? String(request.expectedDeliveryDate) : '',
      receiptDate: request.receiptDate ? String(request.receiptDate) : '',
      lastModified: request.lastModified ? String(request.lastModified) : '',
      lastModifiedBy: request.lastModifiedBy || ''
    };
  } catch (error) {
    Logger.log('getRequest error: ' + error);
    return { success: false, message: String(error) };
  }
}

/**
 * 비밀번호 변경
 * @param {string} oldPassword - 현재 비밀번호
 * @param {string} newPassword - 새 비밀번호
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function changePassword(oldPassword, newPassword, sessionToken) {
  try {
    // 세션에서 사용자 정보 확인
    const currentUser = getCurrentSession(sessionToken);
    if (!currentUser) {
      Logger.log('changePassword: No session found');
      return {
        success: false,
        message: '세션이 만료되었습니다. 다시 로그인해주세요.'
      };
    }
    
    Logger.log('changePassword: Session user found - userId: ' + currentUser.userId);
    Logger.log('changePassword: Session user object: ' + JSON.stringify(currentUser));
    
    // 세션의 userId를 사용 (가장 신뢰할 수 있는 소스)
    const targetUserId = String(currentUser.userId || '').trim();
    
    if (!targetUserId) {
      Logger.log('changePassword: userId is empty in session');
      return {
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.'
      };
    }
    
    Logger.log('changePassword: Target userId: ' + targetUserId);
    
    const userModel = new UserModel();
    
    // 시트 존재 여부 확인
    if (!userModel.sheet) {
      Logger.log('changePassword: Users sheet not found');
      return {
        success: false,
        message: '시스템 오류: 사용자 시트를 찾을 수 없습니다.'
      };
    }
    
    const userData = userModel.findByUserId(targetUserId);
    
    if (!userData) {
      Logger.log('changePassword: User data not found for userId: ' + targetUserId);
      return {
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      };
    }
    
    Logger.log('changePassword: User data found, checking password...');
    
    // 기존 비밀번호 확인 - verifyPassword 함수 사용 (Auth.gs와 동일한 로직)
    if (userData.passwordHash && userData.passwordHash.trim() !== '') {
      if (!verifyPassword(oldPassword, userData.passwordHash)) {
        Logger.log('changePassword: Old password verification failed');
        Logger.log('changePassword: Input password hash would be: ' + hashPassword(oldPassword));
        Logger.log('changePassword: Stored hash: ' + userData.passwordHash);
        return {
          success: false,
          message: '기존 비밀번호가 올바르지 않습니다.'
        };
      }
      Logger.log('changePassword: Old password verified successfully');
    } else {
      Logger.log('changePassword: No password hash found, skipping verification');
    }
    
    // 새 비밀번호 해시 생성 및 저장 - hashPassword 함수 사용
    const newHash = hashPassword(newPassword);
    Logger.log('changePassword: New password hash generated');
    
    userModel.updatePassword(targetUserId, newHash);
    Logger.log('changePassword: Password updated successfully');
    
    new LogService().log('비밀번호 변경', null, targetUserId);
    
    return {
      success: true,
      message: '비밀번호가 변경되었습니다.'
    };
  } catch (error) {
    Logger.log('changePassword wrapper error: ' + error);
    Logger.log('changePassword error stack: ' + error.stack);
    return {
      success: false,
      message: error.message || '비밀번호 변경 중 오류가 발생했습니다.'
    };
  }
}

/**
 * CSV 파일에서 배송지 정보를 가져와서 등록합니다. (관리자 전용)
 * @param {string} csvContent - CSV 파일 내용
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과 객체 {success: boolean, message: string, imported: Object}
 */
function importDeliveryPlacesFromCSV(csvContent, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user || user.role !== CONFIG.ROLES.ADMIN) {
      throw new Error('관리자만 실행할 수 있습니다.');
    }
    
    if (!csvContent) {
      throw new Error('CSV 내용이 필요합니다.');
    }
    
    // CSV 파싱 (Google Apps Script의 parseCsv 사용)
    const lines = Utilities.parseCsv(csvContent);
    if (lines.length < 2) {
      throw new Error('CSV 파일에 데이터가 없습니다.');
    }
    
    // 헤더 파싱
    const headers = lines[0].map(h => String(h).trim());
    const headerMap = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });
    
    Logger.log('CSV 헤더: ' + JSON.stringify(headers));
    Logger.log('헤더 맵: ' + JSON.stringify(headerMap));
    
    // CSV 파일 형식 확인 및 매핑
    // 형식 1: 배송지관리 형식 (배송지명,소속팀,주소,연락처,담당자,활성화,비고)
    // 형식 2: 기준정보 형식 (NO,기사명,사번,사용자,파트,기사코드,배송지)
    let isMasterDataFormat = false;
    let 배송지명Index = headerMap['배송지명'];
    let 소속팀Index = headerMap['소속팀'];
    
    // 기준정보 형식인 경우 (파트별 택배 수령지 취합 형식)
    if (headerMap['파트'] !== undefined && headerMap['배송지'] !== undefined) {
      isMasterDataFormat = true;
      배송지명Index = headerMap['배송지'];
      소속팀Index = headerMap['파트'];
    }
    
    // 필수 헤더 확인
    if (배송지명Index === undefined || 소속팀Index === undefined) {
      throw new Error('CSV 파일에 필수 컬럼(배송지명/배송지, 소속팀/파트)이 없습니다.');
    }
    
    const imported = {
      users: 0,
      deliveryPlaces: 0,
      skippedUsers: 0,
      skippedPlaces: 0
    };
    
    // 사용자관리 시트 준비
    const userModel = new UserModel();
    const userSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.USERS);
    
    if (!userSheet) {
      throw new Error('사용자관리 시트를 찾을 수 없습니다.');
    }
    
    // 사용자관리 시트 헤더 확인 및 생성
    if (userSheet.getLastRow() === 0) {
      userSheet.getRange(1, 1, 1, 8).setValues([[
        '사용자ID', '비밀번호해시', '이름', '기사코드', '소속팀', '지역', '역할', '활성화'
      ]]);
    }
    
    // 배송지관리 시트 준비 (기존 시트 사용, 없으면 생성)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // CONFIG 누락/캐시 이슈 대비 fallback
    const sheetName = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.DELIVERY_PLACES)
      ? String(CONFIG.SHEETS.DELIVERY_PLACES).trim()
      : '배송지관리';
    
    // 기존 시트 찾기 (trim 느슨매칭 포함)
    let deliverySheet = getSheetByNameLoose_(ss, sheetName);
    
    // 시트가 없으면 생성 (한 번만)
    if (!deliverySheet) {
      deliverySheet = ss.insertSheet(sheetName);
      // 헤더 설정
      deliverySheet.getRange(1, 1, 1, 7).setValues([[
        '배송지명', '소속팀', '주소', '연락처', '담당자', '활성화', '비고'
      ]]);
    } else {
      // 기존 시트의 헤더 확인 및 생성 (헤더가 없으면)
      if (deliverySheet.getLastRow() === 0) {
        deliverySheet.getRange(1, 1, 1, 7).setValues([[
          '배송지명', '소속팀', '주소', '연락처', '담당자', '활성화', '비고'
        ]]);
      }
    }
    
    // 기존 사용자 중복 체크용
    const existingUsers = [];
    const userData = userSheet.getDataRange().getValues();
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][0]) {
        existingUsers.push(userData[i][0]); // 사용자ID
      }
    }
    const existingUserSet = new Set(existingUsers);
    
    // 배송지 중복 체크용 (소속팀 + 배송지명)
    // deliverySheet에서 직접 읽어서 중복 체크
    const existingPlaceSet = new Set();
    if (deliverySheet.getLastRow() > 1) {
      const existingData = deliverySheet.getDataRange().getValues();
      const headers = existingData[0];
      const 배송지명Index = headers.indexOf('배송지명');
      const 소속팀Index = headers.indexOf('소속팀');
      
      for (let i = 1; i < existingData.length; i++) {
        const row = existingData[i];
        const 배송지명 = row[배송지명Index] || '';
        const 소속팀 = row[소속팀Index] || '';
        if (배송지명 && 소속팀) {
          const key = 소속팀 + '|' + 배송지명;
          existingPlaceSet.add(key);
        }
      }
    }
    
    // 데이터 행 처리
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].map(v => String(v || '').trim());
      
      // 빈 행 스킵
      if (values.length === 0 || values.every(v => v === '')) continue;
      
      // 기준정보 형식인 경우 사용자 정보도 처리
      if (isMasterDataFormat) {
        const 사번 = values[headerMap['사번']];
        const 사용자 = values[headerMap['사용자']];
        const 파트 = values[headerMap['파트']] || '';
        const 기사코드 = values[headerMap['기사코드']] || '';
        
        // 사용자 등록 (사번과 사용자 이름이 있는 경우)
        if (사번 && 사용자 && 사번.trim() !== '' && 사용자.trim() !== '') {
          // 중복 체크
          if (!existingUserSet.has(사번)) {
            // 지역 추출 (파트에서)
            let 지역 = '';
            if (파트.includes('수도권')) {
              지역 = '수도권';
            } else if (파트.includes('지역팀')) {
              // 지역팀의 경우 배송지에서 지역 추출 시도
              const 배송지 = values[배송지명Index] || '';
              if (배송지.includes('서울')) 지역 = '서울';
              else if (배송지.includes('부산')) 지역 = '부산';
              else if (배송지.includes('대구')) 지역 = '대구';
              else if (배송지.includes('인천')) 지역 = '인천';
              else if (배송지.includes('광주')) 지역 = '광주';
              else if (배송지.includes('대전')) 지역 = '대전';
              else if (배송지.includes('울산')) 지역 = '울산';
              else if (배송지.includes('경기')) 지역 = '경기';
              else if (배송지.includes('충남') || 배송지.includes('천안') || 배송지.includes('아산')) 지역 = '충남';
              else if (배송지.includes('충북') || 배송지.includes('청주')) 지역 = '충북';
              else if (배송지.includes('전남') || 배송지.includes('광주')) 지역 = '전남';
              else if (배송지.includes('전북') || 배송지.includes('전주')) 지역 = '전북';
              else if (배송지.includes('경남')) 지역 = '경남';
              else if (배송지.includes('경북') || 배송지.includes('포항') || 배송지.includes('김천')) 지역 = '경북';
              else if (배송지.includes('강원') || 배송지.includes('원주')) 지역 = '강원';
              else 지역 = '기타';
            } else if (파트.includes('외주')) {
              지역 = '기타';
            }
            
            // 비밀번호 해시 생성 (기본 비밀번호: 1234)
            const passwordHash = hashPassword('1234');
            
            userSheet.appendRow([
              사번,
              passwordHash,
              사용자,
              기사코드,
              파트,
              지역,
              CONFIG.ROLES.USER,
              'Y'
            ]);
            
            existingUserSet.add(사번);
            imported.users++;
          } else {
            imported.skippedUsers++;
          }
        }
      }
      
      // 배송지 처리
      const 배송지명 = values[배송지명Index] || '';
      const 소속팀 = values[소속팀Index] || '';
      
      // 배송지명과 소속팀이 모두 있어야 함 (배송지가 비어있으면 스킵)
      if (배송지명 && 소속팀 && 배송지명.trim() !== '' && 소속팀.trim() !== '') {
        // 기준정보 형식인 경우 추가 필드 매핑
        let 주소 = '';
        let 연락처 = '';
        let 담당자 = '';
        let 활성화 = 'Y';
        let 비고 = '';
        
        if (isMasterDataFormat) {
          // 기준정보 형식: 주소, 연락처, 담당자 등이 없으므로 기본값 사용
          주소 = 배송지명; // 배송지명을 주소로도 사용
        } else {
          // 배송지관리 형식: 모든 필드 사용
          주소 = values[headerMap['주소']] || '';
          연락처 = values[headerMap['연락처']] || '';
          담당자 = values[headerMap['담당자']] || '';
          활성화 = values[headerMap['활성화']] || 'Y';
          비고 = values[headerMap['비고']] || '';
        }
        
        // 중복 체크
        const placeKey = 소속팀 + '|' + 배송지명;
        if (!existingPlaceSet.has(placeKey)) {
          // 배송지 등록
          deliverySheet.appendRow([
            배송지명,
            소속팀,
            주소,
            연락처,
            담당자,
            활성화,
            비고
          ]);
          
          existingPlaceSet.add(placeKey);
          imported.deliveryPlaces++;
        } else {
          imported.skippedPlaces++;
        }
      }
    }
    
    new LogService().log('CSV 기준정보 업로드', null, user.userId);
    
    let message = '';
    if (isMasterDataFormat) {
      message = `기준정보가 등록되었습니다. (사용자: ${imported.users}명, 배송지: ${imported.deliveryPlaces}개)`;
      if (imported.skippedUsers > 0 || imported.skippedPlaces > 0) {
        message += ` (중복/스킵: 사용자 ${imported.skippedUsers}명, 배송지 ${imported.skippedPlaces}개)`;
      }
    } else {
      message = `배송지 정보가 등록되었습니다. (${imported.deliveryPlaces}개)`;
      if (imported.skippedPlaces > 0) {
        message += ` (중복/스킵: ${imported.skippedPlaces}개)`;
      }
    }
    
    return {
      success: true,
      message: message,
      imported: imported
    };
  } catch (error) {
    Logger.log('importDeliveryPlacesFromCSV error: ' + error);
    return ErrorHandler.handle(error, 'importDeliveryPlacesFromCSV');
  }
}

/**
 * 사용자의 파트에 맞는 배송지 목록을 조회합니다.
 * 파트명을 기반으로 배송지관리 시트에서 해당 파트의 배송지를 찾습니다.
 * @param {string} team - 사용자의 소속팀/파트
 * @param {string} sessionToken - 세션 토큰
 * @return {Array} 배송지 목록
 */
function getDeliveryPlacesByTeam(team, sessionToken) {
  try {
    const user = getCurrentUser(sessionToken);
    if (!user) {
      Logger.log('getDeliveryPlacesByTeam: User not found');
      return []; // 빈 배열 반환
    }
    
    const deliveryPlaceModel = new DeliveryPlaceModel();
    
    // 시트 존재 여부 확인
    if (!deliveryPlaceModel.sheet) {
      Logger.log('getDeliveryPlacesByTeam: Delivery place sheet not found');
      return []; // 빈 배열 반환
    }
    
    // 파트명 매핑 로직
    // 사용자의 소속팀과 배송지관리 시트의 소속팀을 매칭
    let matchedPlaces = [];
    
    if (team) {
      // 정확히 일치하는 경우
      matchedPlaces = deliveryPlaceModel.findByTeam(team);
      
      // matchedPlaces가 배열이 아닌 경우 처리
      if (!Array.isArray(matchedPlaces)) {
        Logger.log('getDeliveryPlacesByTeam: findByTeam returned non-array: ' + typeof matchedPlaces);
        matchedPlaces = [];
      }
      
      // 정확히 일치하지 않는 경우, 부분 매칭 시도
      if (matchedPlaces.length === 0) {
        const allPlaces = deliveryPlaceModel.findAll();
        
        // allPlaces가 배열이 아닌 경우 처리
        if (!Array.isArray(allPlaces)) {
          Logger.log('getDeliveryPlacesByTeam: findAll returned non-array: ' + typeof allPlaces);
          return []; // 빈 배열 반환
        }
        
        // 파트명에서 키워드 추출하여 매칭
        const teamKeywords = extractTeamKeywords(team);
        
        matchedPlaces = allPlaces.filter(place => {
          const placeTeam = place['소속팀'] || '';
          
          // 정확히 일치
          if (placeTeam === team) return true;
          
          // 키워드 매칭
          for (let keyword of teamKeywords) {
            if (placeTeam.includes(keyword) || keyword.includes(placeTeam)) {
              return true;
            }
          }
          
          // 부분 일치 (예: "TM센터_FL지역팀 1파트"와 "지역팀 1파트")
          if (team.includes(placeTeam) || placeTeam.includes(team)) {
            return true;
          }
          
          return false;
        });
      }
    } else {
      // 팀 정보가 없으면 모든 배송지 반환
      matchedPlaces = deliveryPlaceModel.findAll();
      
      // matchedPlaces가 배열이 아닌 경우 처리
      if (!Array.isArray(matchedPlaces)) {
        Logger.log('getDeliveryPlacesByTeam: findAll returned non-array: ' + typeof matchedPlaces);
        return []; // 빈 배열 반환
      }
    }
    
    // 배송지명만 추출하여 반환
    return matchedPlaces.map(place => ({
      name: place['배송지명'] || place.name || '',
      '배송지명': place['배송지명'] || place.name || '', // 프론트엔드 호환성
      team: place['소속팀'] || place.team || '',
      address: place['주소'] || place.address || '',
      contact: place['연락처'] || place.contact || ''
    })).filter(place => place.name !== '');
    
  } catch (error) {
    Logger.log('getDeliveryPlacesByTeam error: ' + error);
    Logger.log('getDeliveryPlacesByTeam error stack: ' + error.stack);
    return []; // 에러 발생 시 빈 배열 반환
  }
}

/**
 * 팀명에서 키워드를 추출합니다.
 * @param {string} team - 팀명
 * @return {Array} 키워드 배열
 */
function extractTeamKeywords(team) {
  if (!team) return [];
  
  const keywords = [];
  const teamLower = team.toLowerCase();
  
  // 파트 번호 추출 (예: "1파트", "2파트")
  const partMatch = team.match(/(\d+)파트/);
  if (partMatch) {
    keywords.push(partMatch[0]); // "1파트"
    keywords.push(partMatch[1] + '파트'); // 숫자만
  }
  
  // 주요 키워드 추출
  if (teamLower.includes('지역팀')) keywords.push('지역팀');
  if (teamLower.includes('수도권팀')) keywords.push('수도권팀');
  if (teamLower.includes('외주')) keywords.push('외주');
  if (teamLower.includes('tm센터')) keywords.push('TM센터');
  if (teamLower.includes('fl')) keywords.push('FL');
  
  // 지역 키워드 추출
  const regions = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '경기', '충남', '충북', '전남', '전북', '경남', '경북', '강원'];
  regions.forEach(region => {
    if (team.includes(region)) {
      keywords.push(region);
    }
  });
  
  return keywords;
}

/**
 * 신청 건의 상세 정보를 조회합니다. (하위 호환성)
 * @param {string} requestNo - 신청번호
 * @param {string} sessionToken - 세션 토큰 (선택사항)
 * @return {Object} 신청 상세 정보 객체
 */
function getRequestDetail(requestNo, sessionToken) {
  try {
    const requestModel = new RequestModel();
    const request = requestModel.findById(requestNo);
    
    if (!request) {
      throw new Error('신청 건을 찾을 수 없습니다.');
    }
    
    // 권한 체크 (세션이 있는 경우)
    if (sessionToken) {
      const user = getCurrentUser(sessionToken);
      if (user && user.role !== CONFIG.ROLES.ADMIN && request.requesterEmail !== user.userId) {
        throw new Error('조회 권한이 없습니다.');
      }
    }
    
    return request;
  } catch (error) {
    Logger.log('getRequestDetail error: ' + error);
    return ErrorHandler.handle(error, 'getRequestDetail');
  }
}

// ==========================================
// 초기 설정
// ==========================================

/**
 * 시스템 초기 설정을 수행합니다. (최초 1회 실행)
 * - Properties 초기화
 * - 시트 생성 및 헤더 설정
 * - 트리거 설정
 * @return {Object} 결과 객체 {success: boolean, message: string}
 */
function initialSetup() {
  try {
    // 1. Properties 설정
    initializeProperties();
    
    // 2. 시트 생성 및 헤더 설정
    createSheets();
    
    // 3. 트리거 설정
    setupAllTriggers();
    
    Logger.log('Initial setup completed successfully!');
    return { success: true, message: '초기 설정이 완료되었습니다.' };
  } catch (error) {
    Logger.log('initialSetup error: ' + error);
    return { success: false, message: error.message };
  }
}

function createSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = Object.values(CONFIG.SHEETS)
    .map(n => (n === null || n === undefined) ? '' : String(n).trim())
    .filter(n => n.length > 0);
  
  sheetNames.forEach(name => {
    let sheet = getSheetByNameLoose_(ss, name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      setupSheetHeaders(sheet, name);
    }
  });
}

/**
 * 시트 이름을 공백(trim) 기준으로도 매칭해서 찾습니다.
 * - 예: 실제 시트명이 '배송지관리 '처럼 공백이 섞여있어도 찾을 수 있게 함
 * - 가능하면 발견한 시트를 canonicalName으로 rename 시도(충돌 시 스킵)
 */
function getSheetByNameLoose_(ss, canonicalName) {
  const target = (canonicalName === null || canonicalName === undefined) ? '' : String(canonicalName).trim();
  if (!target) return null;
  
  // 1) 정확히 일치
  let sheet = ss.getSheetByName(target);
  if (sheet) return sheet;
  
  // 2) trim 기준 느슨 매칭
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const n = String(s.getName() || '');
    if (n.trim() === target) {
      // 이름이 다르면 canonicalName으로 rename 시도 (중복 이름이면 예외 발생)
      if (n !== target) {
        try {
          s.setName(target);
        } catch (e) {
          // rename 실패해도 그대로 사용
        }
      }
      return s;
    }
  }
  
  return null;
}

function setupSheetHeaders(sheet, sheetName) {
  const headers = {
    [CONFIG.SHEETS.REQUESTS]: [
      '신청번호', '신청일시', '신청자ID', '신청자이름', '기사코드',
      '소속팀', '지역', '품명', '규격', '시리얼번호', '수량',
      '관리번호', '배송지', '전화번호', '업체명', '비고', '사진URL',
      '상태', '접수담당자', '담당자비고', '발주일시', '예상납기일',
      '수령확인일시', '최종수정일시', '최종수정자'
    ],
    [CONFIG.SHEETS.USERS]: [
      '사용자ID', '비밀번호해시', '이름', '기사코드', '소속팀', '지역', '역할', '활성화'
    ],
    [CONFIG.SHEETS.LOGS]: [
      '일시', '레벨', '액션', '신청번호', '사용자', '상세내용'
    ],
    [CONFIG.SHEETS.DELIVERY_PLACES]: [
      '배송지명', '소속팀', '주소', '연락처', '담당자', '활성화', '비고'
    ]
  };
  
  if (headers[sheetName]) {
    const headerRange = sheet.getRange(1, 1, 1, headers[sheetName].length);
    headerRange.setValues([headers[sheetName]])
      .setFontWeight('bold')
      .setBackground('#4285F4')
      .setFontColor('#FFFFFF');
  }
}

/**
 * Google Drive 이미지를 Base64로 변환하여 반환
 */
function getImageAsBase64(driveUrl, sessionToken) {
  try {
    // 세션 확인
    const user = getCurrentSession(sessionToken);
    if (!user) {
      return { success: false, error: '세션이 만료되었습니다.' };
    }
    
    if (!driveUrl || !driveUrl.includes('drive.google.com')) {
      return { success: false, error: '유효하지 않은 Google Drive URL입니다.' };
    }
    
    // 파일 ID 추출
    let fileId = null;
    const match1 = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) {
      fileId = match1[1];
    } else {
      const match2 = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match2) {
        fileId = match2[1];
      }
    }
    
    if (!fileId) {
      return { success: false, error: '파일 ID를 찾을 수 없습니다.' };
    }
    
    // Google Drive에서 파일 가져오기
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    
    // Base64로 변환
    const base64Data = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();
    const dataUrl = 'data:' + mimeType + ';base64,' + base64Data;
    
    return {
      success: true,
      dataUrl: dataUrl,
      mimeType: mimeType
    };
    
  } catch (error) {
    Logger.log('getImageAsBase64 error: ' + error);
    return { success: false, error: error.message || '이미지를 가져오는데 실패했습니다.' };
  }
}

// ==========================================
// REST API 핸들러 (st_checklist 패턴)
// ==========================================

/**
 * GET 요청 API 핸들러
 */
function handleGetApi(action, params) {
  try {
    const sessionToken = params.token || '';
    let result;
    
    switch (action) {
      case 'getCurrentUser':
        result = getCurrentUser(sessionToken);
        break;
        
      case 'getMyRequests':
        const filter = {};
        if (params.status) filter.status = params.status;
        if (params.dateFrom) filter.dateFrom = params.dateFrom;
        if (params.dateTo) filter.dateTo = params.dateTo;
        // 페이징 파라미터 추가
        if (params.page) filter.page = params.page;
        if (params.pageSize) filter.pageSize = params.pageSize;
        if (params.sortBy) filter.sortBy = params.sortBy;
        if (params.sortOrder) filter.sortOrder = params.sortOrder;
        result = getMyRequests(filter, sessionToken);
        break;
        
      case 'getRequest':
        if (!params.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = getRequest(params.requestNo, sessionToken);
        }
        break;
        
      case 'getRequestDetail':
        if (!params.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = getRequestDetail(params.requestNo, sessionToken);
        }
        break;
        
      case 'getDashboardData':
        result = getDashboardData(sessionToken);
        break;
        
      case 'getRequestStats':
        result = getRequestStats(sessionToken);
        break;
        
      case 'getNotifications':
        result = getNotifications(sessionToken);
        break;
        
      case 'getDeliveryPlaces':
        const team = params.team || null;
        result = getDeliveryPlaces(team, sessionToken);
        break;
        
      case 'getAllDeliveryPlaces':
        result = getAllDeliveryPlaces(sessionToken);
        break;
        
      case 'getAllRequests':
        const allRequestsFilter = {};
        if (params.status) allRequestsFilter.status = params.status;
        if (params.region) allRequestsFilter.region = params.region;
        if (params.dateFrom) allRequestsFilter.dateFrom = params.dateFrom;
        if (params.dateTo) allRequestsFilter.dateTo = params.dateTo;
        if (params.page) allRequestsFilter.page = params.page;
        if (params.pageSize) allRequestsFilter.pageSize = params.pageSize;
        if (params.sortBy) allRequestsFilter.sortBy = params.sortBy;
        if (params.sortOrder) allRequestsFilter.sortOrder = params.sortOrder;
        result = getAllRequests(allRequestsFilter, sessionToken);
        break;
        
      case 'assignHandler':
        if (!params.requestNo || !params.handlerEmail) {
          result = { success: false, message: '신청번호와 담당자 이메일이 필요합니다.' };
        } else {
          result = assignHandler(params.requestNo, params.handlerEmail, sessionToken);
        }
        break;
        
      case 'updateRequesterRemarks':
        if (!params.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = updateRequesterRemarks(
            params.requestNo,
            params.requesterRemarks || '',
            sessionToken
          );
        }
        break;
        
      case 'updateHandlerRemarks':
        if (!params.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = updateHandlerRemarks(
            params.requestNo,
            params.handlerRemarks || '',
            sessionToken
          );
        }
        break;
        
      case 'getAllUsers':
        result = getAllUsers(sessionToken);
        break;
        
      case 'createUser':
        let createUserData = params.userData;
        if (typeof createUserData === 'string') {
          try {
            createUserData = JSON.parse(createUserData);
          } catch (e) {
            result = { success: false, message: 'userData 파싱 오류: ' + e.toString() };
            break;
          }
        }
        result = createUser(createUserData, sessionToken);
        break;
        
      case 'updateUser':
        let updateUserData = params.userData;
        if (typeof updateUserData === 'string') {
          try {
            updateUserData = JSON.parse(updateUserData);
          } catch (e) {
            result = { success: false, message: 'userData 파싱 오류: ' + e.toString() };
            break;
          }
        }
        result = updateUser(params.userId, updateUserData, sessionToken);
        break;
        
      case 'deleteUser':
        result = deleteUser(params.userId, sessionToken);
        break;
        
      case 'createDeliveryPlace':
        let createPlaceData = params.placeData;
        if (typeof createPlaceData === 'string') {
          try {
            createPlaceData = JSON.parse(createPlaceData);
          } catch (e) {
            result = { success: false, message: 'placeData 파싱 오류: ' + e.toString() };
            break;
          }
        }
        result = createDeliveryPlace(createPlaceData, sessionToken);
        break;
        
      case 'updateDeliveryPlace':
        let updatePlaceData = params.placeData;
        if (typeof updatePlaceData === 'string') {
          try {
            updatePlaceData = JSON.parse(updatePlaceData);
          } catch (e) {
            result = { success: false, message: 'placeData 파싱 오류: ' + e.toString() };
            break;
          }
        }
        result = updateDeliveryPlace(params.placeName, updatePlaceData, sessionToken);
        break;
        
      case 'deleteDeliveryPlace':
        result = deleteDeliveryPlace(params.placeName, sessionToken);
        break;
        
      case 'getCodeList':
        const type = params.type || '';
        result = getCodeList(type);
        break;
        
      case 'getWebAppUrl':
        result = getWebAppUrl();
        break;
        
      case 'getImageAsBase64':
        if (!params.driveUrl) {
          result = { success: false, error: 'Drive URL이 필요합니다.' };
        } else {
          result = getImageAsBase64(params.driveUrl, sessionToken);
        }
        break;
        
      // POST 액션들 추가 (GET 요청으로도 처리 가능하도록)
      case 'createRequest':
        if (!params.formData) {
          result = { success: false, message: 'formData가 필요합니다.' };
        } else {
          // formData가 JSON 문자열인 경우 파싱
          let formData = params.formData;
          if (typeof formData === 'string') {
            try {
              formData = JSON.parse(formData);
            } catch (e) {
              result = { success: false, message: 'formData 파싱 오류: ' + e.toString() };
              break;
            }
          }
          result = createRequest(formData, sessionToken);
        }
        break;
        
      case 'cancelRequest':
        if (!params.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = cancelRequest(params.requestNo, sessionToken);
        }
        break;
        
      case 'confirmReceipt':
        if (!params.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = confirmReceipt(params.requestNo, sessionToken);
        }
        break;
        
      case 'changePassword':
        if (!params.oldPassword || !params.newPassword) {
          result = { success: false, message: '비밀번호 정보가 필요합니다.' };
        } else {
          result = changePassword(params.oldPassword, params.newPassword, sessionToken);
        }
        break;
        
      case 'updateRequestStatus':
        if (!params.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          // JSON 문자열 파싱
          let remarks = params.remarks || '';
          let handler = params.handler || '';
          let expectedDeliveryDate = params.expectedDeliveryDate || '';
          let requesterRemarks = params.requesterRemarks;
          
          result = updateRequestStatus(
            params.requestNo,
            params.newStatus,
            remarks,
            sessionToken,
            handler,
            expectedDeliveryDate,
            requesterRemarks
          );
        }
        break;
        
      case 'login':
        if (!params.userId || !params.password) {
          result = { success: false, message: '사용자 ID와 비밀번호가 필요합니다.' };
        } else {
          result = login(params.userId, params.password);
        }
        break;
        
      case 'logout':
        result = logout(sessionToken);
        break;
        
      default:
        result = { success: false, message: '알 수 없는 action: ' + action };
    }
    
    return createJsonResponse_(result);
      
  } catch (error) {
    Logger.log('handleGetApi error: ' + error);
    const errorResult = { 
      success: false, 
      message: error.message || 'API 호출 중 오류가 발생했습니다.',
      error: error.toString()
    };
    return createJsonResponse_(errorResult);
  }
}

/**
 * POST 요청 API 핸들러
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse_({ 
        success: false, 
        message: '요청 데이터가 없습니다.' 
      });
    }
    
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const sessionToken = payload.token || '';
    
    let result;
    
    switch (action) {
      case 'createRequest':
        if (!payload.formData) {
          result = { success: false, message: 'formData가 필요합니다.' };
        } else {
          result = createRequest(payload.formData, sessionToken);
        }
        break;
        
      case 'updateRequestStatus':
        if (!payload.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = updateRequestStatus(
            payload.requestNo,
            payload.newStatus,
            payload.remarks || '',
            sessionToken,
            payload.handler || '',
            payload.expectedDeliveryDate || '',
            payload.requesterRemarks
          );
        }
        break;
        
      case 'cancelRequest':
        if (!payload.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = cancelRequest(payload.requestNo, sessionToken);
        }
        break;
        
      case 'confirmReceipt':
        if (!payload.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = confirmReceipt(payload.requestNo, sessionToken);
        }
        break;
        
      case 'changePassword':
        if (!payload.oldPassword || !payload.newPassword) {
          result = { success: false, message: '비밀번호 정보가 필요합니다.' };
        } else {
          result = changePassword(payload.oldPassword, payload.newPassword, sessionToken);
        }
        break;
        
      case 'bulkUpdateStatus':
        if (!payload.requestNos || !Array.isArray(payload.requestNos)) {
          result = { success: false, message: '신청번호 배열이 필요합니다.' };
        } else {
          result = bulkUpdateStatus(
            payload.requestNos,
            payload.newStatus,
            payload.remarks || '',
            sessionToken
          );
        }
        break;
        
      case 'assignHandler':
        if (!payload.requestNo || !payload.handlerEmail) {
          result = { success: false, message: '신청번호와 담당자 이메일이 필요합니다.' };
        } else {
          result = assignHandler(payload.requestNo, payload.handlerEmail, sessionToken);
        }
        break;
        
      case 'updateRequesterRemarks':
        if (!payload.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = updateRequesterRemarks(
            payload.requestNo,
            payload.requesterRemarks || '',
            sessionToken
          );
        }
        break;
        
      case 'updateHandlerRemarks':
        if (!payload.requestNo) {
          result = { success: false, message: '신청번호가 필요합니다.' };
        } else {
          result = updateHandlerRemarks(
            payload.requestNo,
            payload.handlerRemarks || '',
            sessionToken
          );
        }
        break;
        
      case 'getAllUsers':
        result = getAllUsers(sessionToken);
        break;
        
      case 'createUser':
        if (!payload.userData) {
          result = { success: false, message: 'userData가 필요합니다.' };
        } else {
          result = createUser(payload.userData, sessionToken);
        }
        break;
        
      case 'updateUser':
        if (!payload.userId || !payload.userData) {
          result = { success: false, message: 'userId와 userData가 필요합니다.' };
        } else {
          result = updateUser(payload.userId, payload.userData, sessionToken);
        }
        break;
        
      case 'deleteUser':
        if (!payload.userId) {
          result = { success: false, message: 'userId가 필요합니다.' };
        } else {
          result = deleteUser(payload.userId, sessionToken);
        }
        break;
        
      case 'getAllDeliveryPlaces':
        result = getAllDeliveryPlaces(sessionToken);
        break;
        
      case 'createDeliveryPlace':
        if (!payload.placeData) {
          result = { success: false, message: 'placeData가 필요합니다.' };
        } else {
          result = createDeliveryPlace(payload.placeData, sessionToken);
        }
        break;
        
      case 'updateDeliveryPlace':
        if (!payload.placeName || !payload.placeData) {
          result = { success: false, message: 'placeName과 placeData가 필요합니다.' };
        } else {
          result = updateDeliveryPlace(payload.placeName, payload.placeData, sessionToken);
        }
        break;
        
      case 'deleteDeliveryPlace':
        if (!payload.placeName) {
          result = { success: false, message: 'placeName이 필요합니다.' };
        } else {
          result = deleteDeliveryPlace(payload.placeName, sessionToken);
        }
        break;
        
      case 'getRegionTeams':
        result = { success: true, data: getRegionTeams(sessionToken) };
        break;
        
      case 'createRegionTeam':
        if (!payload.regionTeamData) {
          result = { success: false, message: 'regionTeamData가 필요합니다.' };
        } else {
          result = createRegionTeam(payload.regionTeamData, sessionToken);
        }
        break;
        
      case 'updateRegionTeam':
        if (!payload.updateData) {
          result = { success: false, message: 'updateData가 필요합니다.' };
        } else {
          result = updateRegionTeam(payload.updateData, sessionToken);
        }
        break;
        
      case 'deleteRegionTeam':
        if (!payload.deleteData) {
          result = { success: false, message: 'deleteData가 필요합니다.' };
        } else {
          result = deleteRegionTeam(payload.deleteData, sessionToken);
        }
        break;
        
      case 'login':
        if (!payload.userId || !payload.password) {
          result = { success: false, message: '사용자 ID와 비밀번호가 필요합니다.' };
        } else {
          result = login(payload.userId, payload.password);
        }
        break;
        
      case 'logout':
        result = logout(sessionToken);
        break;
        
      default:
        result = { success: false, message: '알 수 없는 action: ' + action };
    }
    
    return createJsonResponse_(result);
      
  } catch (error) {
    Logger.log('doPost error: ' + error);
    const errorResult = { 
      success: false, 
      message: error.message || 'API 호출 중 오류가 발생했습니다.',
      error: error.toString()
    };
    return createJsonResponse_(errorResult);
  } finally {
    lock.releaseLock();
  }
}

