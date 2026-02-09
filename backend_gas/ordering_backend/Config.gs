// ==========================================
// 전역 설정
// ==========================================

const CONFIG = {
  // 스프레드시트 설정
  // 기본은 활성 스프레드시트이지만, 배포/복제/바인딩 상태에 따라 다른 시트를 바라볼 수 있으므로
  // Script Properties의 SPREADSHEET_ID가 있으면 그 값을 우선 사용합니다.
  // (권장) Script Properties에 SPREADSHEET_ID를 설정해 운영 시트를 명시하세요.
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId(),
  
  // 시트 이름
  SHEETS: {
    REQUESTS: '신청내역',
    USERS: '사용자관리',
    CODES: '코드관리',
    LOGS: '로그',
    DASHBOARD: '대시보드',
    DELIVERY_PLACES: '배송지관리'
  },
  
  // Drive 폴더 (초기화 시 설정됨)
  DRIVE_FOLDER_ID: null,
  
  // 이메일 설정
  EMAIL: {
    ENABLED: true,
    ADMIN_NOTIFICATION: true,
    USER_NOTIFICATION: true,
    FROM_NAME: '부품발주시스템'
  },
  
  // 신청번호 형식
  REQUEST_NO_FORMAT: 'YYMMDD0000',
  
  // 상태 코드 (축소된 상태값)
  STATUS: {
    REQUESTED: '접수중',
    ORDERING: '접수완료',
    COMPLETED_CONFIRMED: '발주완료(납기확인)',
    COMPLETED_PENDING: '발주완료(납기미정)',
    FINISHED: '처리완료',
    CANCELLED: '접수취소'
  },
  
  // 역할
  ROLES: {
    USER: '신청자',
    ADMIN: '관리자'
  },
  
  // 파일 업로드 제한
  FILE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
    IMAGE_QUALITY: 0.85,
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1080
  },
  
  // 페이징
  PAGE_SIZE: 50,
  
  // 캐시 설정
  CACHE: {
    ENABLED: true,
    TTL: 300 // 5분
  },
  
  // 디버그 설정
  DEBUG: {
    ENABLED: false, // 프로덕션에서는 false
    LOG_LEVEL: 'ERROR' // ERROR, WARN, INFO, DEBUG
  }
};

/**
 * Script Properties에서 값을 가져옵니다.
 * @param {string} key - 속성 키
 * @return {string|null} 속성 값 또는 null
 */
function getProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * Script Properties에 값을 저장합니다.
 * @param {string} key - 속성 키
 * @param {string} value - 속성 값
 */
function setProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

/**
 * 시스템 Properties를 초기화합니다. (Drive 폴더 생성 포함)
 * @throws {Error} 초기화 실패 시 오류 발생
 */
function initializeProperties() {
  const props = PropertiesService.getScriptProperties();
  
  try {
    // Drive 폴더 생성
    const folder = DriveApp.createFolder('부품발주_사진첨부');
    
    // 폴더 공유 설정 (링크가 있는 사람은 볼 수 있음)
    try {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      // 공유 설정 실패 시에도 계속 진행
      Logger.log('Folder sharing setting failed: ' + sharingError);
      // 기본 공유 설정 시도
      try {
        folder.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
      } catch (e) {
        Logger.log('Alternative sharing setting also failed: ' + e);
      }
    }
    
    props.setProperties({
      'DRIVE_FOLDER_ID': folder.getId(),
      'INITIALIZED': 'true',
      'VERSION': '1.0.0',
      'DEPLOY_DATE': new Date().toISOString()
    });
    
    // CONFIG에 반영
    CONFIG.DRIVE_FOLDER_ID = folder.getId();
    
    Logger.log('Properties initialized successfully. Folder ID: ' + folder.getId());
  } catch (error) {
    Logger.log('initializeProperties error: ' + error);
    throw new Error('초기화 중 오류가 발생했습니다: ' + error.message);
  }
}

