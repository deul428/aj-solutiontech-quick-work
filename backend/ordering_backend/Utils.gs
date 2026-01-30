// ==========================================
// 유틸리티 함수
// ==========================================

/**
 * 날짜를 지정된 형식으로 포맷팅합니다.
 * @param {Date|string} date - 포맷팅할 날짜
 * @param {string} format - 날짜 형식 (기본값: 'yyyy-MM-dd')
 * @return {string} 포맷팅된 날짜 문자열
 */
function formatDate(date, format = 'yyyy-MM-dd') {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), 'Asia/Seoul', format);
}

/**
 * 두 날짜가 같은 날인지 비교합니다.
 * @param {Date|string} date1 - 첫 번째 날짜
 * @param {Date|string} date2 - 두 번째 날짜
 * @return {boolean} 같은 날이면 true, 아니면 false
 */
function isSameDate(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

// 로깅 헬퍼 함수
function log(level, message) {
  if (!CONFIG.DEBUG.ENABLED) return;
  
  const levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const currentLevel = levels[CONFIG.DEBUG.LOG_LEVEL] || 0;
  const messageLevel = levels[level] || 0;
  
  if (messageLevel <= currentLevel) {
    Logger.log(`[${level}] ${message}`);
  }
}

// 캐시 관리
class CacheManager {
  constructor() {
    this.cache = CacheService.getScriptCache();
  }
  
  get(key) {
    if (!CONFIG.CACHE.ENABLED) return null;
    
    const cached = this.cache.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  set(key, value, ttl = CONFIG.CACHE.TTL) {
    if (!CONFIG.CACHE.ENABLED) return;
    
    this.cache.put(key, JSON.stringify(value), ttl);
  }
  
  remove(key) {
    this.cache.remove(key);
  }
  
  clear() {
    this.cache.removeAll([]);
  }
  
  // 와일드카드 패턴으로 여러 키 삭제 (제한적 지원)
  removePattern(pattern) {
    // Google Apps Script CacheService는 와일드카드를 지원하지 않으므로
    // 특정 패턴의 키들을 직접 관리해야 함
    // 이는 구현 복잡도를 높이므로, 필요시 별도 키 목록 관리 필요
  }
}

// Lock 메커니즘 (동시성 제어)
class LockManager {
  constructor() {
    this.lock = LockService.getScriptLock();
  }
  
  acquire(timeout = 10000) {
    try {
      return this.lock.tryLock(timeout);
    } catch (e) {
      Logger.log('Lock acquire failed: ' + e);
      return false;
    }
  }
  
  release() {
    try {
      this.lock.releaseLock();
    } catch (e) {
      Logger.log('Lock release failed: ' + e);
    }
  }
  
  withLock(callback, timeout = 10000) {
    if (this.acquire(timeout)) {
      try {
        return callback();
      } finally {
        this.release();
      }
    } else {
      throw new Error('시스템이 사용 중입니다. 잠시 후 다시 시도해 주세요.');
    }
  }
}

// 에러 핸들링
class ErrorHandler {
  static handle(error, context = '') {
    const errorMessage = error.message || error.toString();
    
    Logger.log(`Error in ${context}: ${errorMessage}`);
    Logger.log(error.stack);
    
    // Stackdriver Logging
    console.error(`${context}: ${errorMessage}`, error.stack);
    
    return {
      success: false,
      message: this._getUserFriendlyMessage(errorMessage),
      technical: errorMessage
    };
  }
  
  static _getUserFriendlyMessage(technicalMessage) {
    const messages = {
      'Authorization required': '권한이 필요합니다. 다시 로그인해 주세요.',
      'Service invoked too many times': '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      'Quota exceeded': '일일 사용량을 초과했습니다. 내일 다시 시도해 주세요.',
      'Timeout': '처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
    };
    
    for (const [key, value] of Object.entries(messages)) {
      if (technicalMessage.includes(key)) {
        return value;
      }
    }
    
    return '오류가 발생했습니다. 관리자에게 문의해 주세요.';
  }
}

// 데이터 검증
class Validator {
  static isEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
  
  static isPhone(phone) {
    const regex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    return regex.test(phone.replace(/[^0-9]/g, ''));
  }
  
  static isNotEmpty(value) {
    return value && value.toString().trim() !== '';
  }
  
  static isNumber(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }
  
  static isInRange(value, min, max) {
    const num = parseFloat(value);
    return this.isNumber(num) && num >= min && num <= max;
  }
}

/**
 * HTML 파일을 포함합니다. (템플릿에서 사용)
 * @param {string} filename - 포함할 HTML 파일 이름 (확장자 제외)
 * @return {string} HTML 파일 내용
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

