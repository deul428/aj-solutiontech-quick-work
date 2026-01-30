// ==========================================
// 인증 및 세션 관리
// ==========================================

/**
 * 세션 관리 클래스
 */
class SessionManager {
  constructor() {
    this.cache = CacheService.getScriptCache();
    this.SESSION_TTL = 3600; // 1시간
  }
  
  /**
   * 세션 생성
   * @param {string} userId - 사용자 ID
   * @param {Object} userInfo - 사용자 정보
   * @return {string} 세션 토큰
   */
  createSession(userId, userInfo) {
    const sessionToken = Utilities.getUuid();
    const sessionData = {
      userId: userId,
      userInfo: userInfo,
      createdAt: new Date().getTime(),
      expiresAt: new Date().getTime() + (this.SESSION_TTL * 1000)
    };
    
    this.cache.put('session_' + sessionToken, JSON.stringify(sessionData), this.SESSION_TTL);
    this.cache.put('user_session_' + userId, sessionToken, this.SESSION_TTL);
    
    Logger.log('Session created for user: ' + userId);
    return sessionToken;
  }
  
  /**
   * 세션 확인
   * @param {string} sessionToken - 세션 토큰
   * @return {Object|null} 세션 데이터 또는 null
   */
  getSession(sessionToken) {
    if (!sessionToken) return null;
    
    const cached = this.cache.get('session_' + sessionToken);
    if (!cached) return null;
    
    const sessionData = JSON.parse(cached);
    
    // 세션 만료 확인
    if (new Date().getTime() > sessionData.expiresAt) {
      this.destroySession(sessionToken);
      return null;
    }
    
    // 세션 연장
    sessionData.expiresAt = new Date().getTime() + (this.SESSION_TTL * 1000);
    this.cache.put('session_' + sessionToken, JSON.stringify(sessionData), this.SESSION_TTL);
    
    return sessionData;
  }
  
  /**
   * 세션 삭제
   * @param {string} sessionToken - 세션 토큰
   */
  destroySession(sessionToken) {
    if (!sessionToken) return;
    
    const cached = this.cache.get('session_' + sessionToken);
    if (cached) {
      const sessionData = JSON.parse(cached);
      this.cache.remove('user_session_' + sessionData.userId);
    }
    
    this.cache.remove('session_' + sessionToken);
    Logger.log('Session destroyed: ' + sessionToken);
  }
  
  /**
   * 사용자 ID로 세션 삭제
   * @param {string} userId - 사용자 ID
   */
  destroySessionByUserId(userId) {
    const userSessionKey = 'user_session_' + userId;
    const sessionToken = this.cache.get(userSessionKey);
    
    if (sessionToken) {
      // 세션 데이터 삭제
      this.destroySession(sessionToken);
    } else {
      // 세션 토큰이 없어도 user_session 키는 삭제 (혹시 모를 경우 대비)
      this.cache.remove(userSessionKey);
    }
    
    Logger.log('Session destroyed for userId: ' + userId);
  }
}

/**
 * 비밀번호 해시 생성
 * @param {string} password - 평문 비밀번호
 * @return {string} SHA-256 해시
 */
function hashPassword(password) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  
  // 바이트 배열을 16진수 문자열로 변환
  // Utilities.computeDigest는 -128~127 범위의 바이트를 반환
  // 이를 0-255 범위의 unsigned 바이트로 변환
  let hexString = '';
  for (let i = 0; i < rawHash.length; i++) {
    let byte = rawHash[i];
    // 음수 바이트를 양수로 변환
    if (byte < 0) {
      byte = byte + 256;
    }
    // 16진수로 변환 (소문자, 2자리 패딩)
    hexString += ('0' + byte.toString(16)).slice(-2);
  }
  
  return hexString;
}

/**
 * 비밀번호 검증
 * @param {string} password - 입력한 비밀번호
 * @param {string} hash - 저장된 해시
 * @return {boolean} 일치 여부
 */
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

/**
 * 로그인 처리
 * @param {string} userId - 사용자 ID
 * @param {string} password - 비밀번호
 * @return {Object} 로그인 결과
 */
function login(userId, password) {
  try {
    if (!userId || !password) {
      return {
        success: false,
        message: '사용자 ID와 비밀번호를 입력해 주세요.'
      };
    }
    
    Logger.log('Login attempt - userId: ' + userId);
    
    // userId 정규화
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      return {
        success: false,
        message: '사용자 ID를 입력해 주세요.'
      };
    }
    
    const userModel = new UserModel();
    
    // 시트 존재 여부 확인
    if (!userModel.sheet) {
      Logger.log('Login: Users sheet not found');
      return {
        success: false,
        message: '시스템 오류: 사용자 시트를 찾을 수 없습니다.'
      };
    }
    
    const user = userModel.findByUserId(normalizedUserId);
    
    if (!user) {
      Logger.log('User not found: ' + normalizedUserId);
      return {
        success: false,
        message: '사용자 ID 또는 비밀번호가 올바르지 않습니다.'
      };
    }
    
    Logger.log('User found: ' + user.name + ', Active: ' + user.active);
    Logger.log('Stored hash: ' + user.passwordHash);
    
    if (user.active !== 'Y') {
      return {
        success: false,
        message: '비활성화된 계정입니다.'
      };
    }
    
    // 비밀번호 해시 생성
    const inputHash = hashPassword(password);
    Logger.log('Input hash: ' + inputHash);
    Logger.log('Hash match: ' + (inputHash === user.passwordHash));
    
    // 비밀번호 검증
    if (!verifyPassword(password, user.passwordHash)) {
      Logger.log('Password verification failed');
      return {
        success: false,
        message: '사용자 ID 또는 비밀번호가 올바르지 않습니다.'
      };
    }
    
    Logger.log('Password verified successfully');
    
    // 세션 생성 전에 해당 사용자의 기존 세션 삭제 (중복 세션 방지)
    const sessionManager = new SessionManager();
    sessionManager.destroySessionByUserId(userId);
    Logger.log('Previous session destroyed for user: ' + userId);
    
    // 새 세션 생성
    const sessionToken = sessionManager.createSession(userId, {
      userId: user.userId,
      name: user.name,
      employeeCode: user.employeeCode,
      team: user.team,
      region: user.region,
      role: user.role
    });
    
    // 로그 기록
    new LogService().log('로그인', null, userId);
    
    return {
      success: true,
      sessionToken: sessionToken,
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
        team: user.team,
        region: user.region,
        employeeCode: user.employeeCode
      },
      redirectUrl: user.role === CONFIG.ROLES.ADMIN ? '?page=admin' : '?page=user'
    };
    
  } catch (error) {
    Logger.log('login error: ' + error);
    return {
      success: false,
      message: '로그인 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 로그아웃 처리
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 로그아웃 결과
 */
function logout(sessionToken) {
  try {
    const sessionManager = new SessionManager();
    const session = sessionManager.getSession(sessionToken);
    
    if (session) {
      new LogService().log('로그아웃', null, session.userId);
      sessionManager.destroySession(sessionToken);
    }
    
    return {
      success: true,
      message: '로그아웃되었습니다.'
    };
  } catch (error) {
    Logger.log('logout error: ' + error);
    return {
      success: false,
      message: '로그아웃 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 현재 세션 확인
 * @param {string} sessionToken - 세션 토큰
 * @return {Object|null} 사용자 정보 또는 null
 */
function getCurrentSession(sessionToken) {
  try {
    if (!sessionToken) {
      Logger.log('getCurrentSession: No sessionToken provided');
      return null;
    }
    
    const sessionManager = new SessionManager();
    const session = sessionManager.getSession(sessionToken);
    
    if (!session) {
      Logger.log('getCurrentSession: No session found for token');
      return null;
    }
    
    Logger.log('getCurrentSession: session.userId = ' + session.userId);
    Logger.log('getCurrentSession: session.userInfo = ' + JSON.stringify(session.userInfo));
    
    // userInfo에 userId가 없으면 session.userId를 추가
    if (session.userInfo && !session.userInfo.userId && session.userId) {
      session.userInfo.userId = session.userId;
      Logger.log('getCurrentSession: Added userId from session to userInfo');
    }
    
    return session.userInfo;
  } catch (error) {
    Logger.log('getCurrentSession error: ' + error);
    Logger.log('getCurrentSession error stack: ' + error.stack);
    return null;
  }
}

/**
 * 관리자가 사용자 비밀번호를 초기화합니다. (관리자 전용)
 * @param {string} targetUserId - 대상 사용자 ID
 * @param {string} newPassword - 새 비밀번호
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과
 */
function resetUserPassword(targetUserId, newPassword, sessionToken) {
  try {
    // 관리자 권한 확인
    const currentUser = getCurrentSession(sessionToken);
    if (!currentUser || currentUser.role !== CONFIG.ROLES.ADMIN) {
      return {
        success: false,
        message: '관리자만 비밀번호를 초기화할 수 있습니다.'
      };
    }
    
    const userModel = new UserModel();
    const user = userModel.findByUserId(targetUserId);
    
    if (!user) {
      return {
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      };
    }
    
    // 새 비밀번호 해시 생성 및 저장
    const newHash = hashPassword(newPassword);
    userModel.updatePassword(targetUserId, newHash);
    
    new LogService().log('비밀번호 초기화 (관리자)', null, currentUser.userId + ' -> ' + targetUserId);
    
    return {
      success: true,
      message: '비밀번호가 초기화되었습니다.'
    };
  } catch (error) {
    Logger.log('resetUserPassword error: ' + error);
    return {
      success: false,
      message: '비밀번호 초기화 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 모든 사용자의 비밀번호를 기본 비밀번호로 초기화합니다. (관리자 전용, 마이그레이션용)
 * @param {string} defaultPassword - 기본 비밀번호
 * @param {string} sessionToken - 세션 토큰
 * @return {Object} 결과
 */
function initializeAllPasswords(defaultPassword, sessionToken) {
  try {
    // 관리자 권한 확인
    const currentUser = getCurrentSession(sessionToken);
    if (!currentUser || currentUser.role !== CONFIG.ROLES.ADMIN) {
      return {
        success: false,
        message: '관리자만 실행할 수 있습니다.'
      };
    }
    
    if (!defaultPassword) {
      return {
        success: false,
        message: '기본 비밀번호를 입력해 주세요.'
      };
    }
    
    const userModel = new UserModel();
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        success: false,
        message: '사용자 데이터가 없습니다.'
      };
    }
    
    // 헤더 가져오기
    const headers = data[0];
    const userIdCol = headers.indexOf('사용자ID');
    const passwordHashCol = headers.indexOf('비밀번호해시');
    const activeCol = headers.indexOf('활성화');
    
    if (userIdCol < 0 || passwordHashCol < 0 || activeCol < 0) {
      return {
        success: false,
        message: '필수 컬럼을 찾을 수 없습니다.'
      };
    }
    
    const defaultHash = hashPassword(defaultPassword);
    let updatedCount = 0;
    
    // 비밀번호가 비어있는 사용자만 초기화
    for (let i = 1; i < data.length; i++) {
      const userId = data[i][userIdCol];
      const currentHash = data[i][passwordHashCol];
      const active = data[i][activeCol];
      
      // 비밀번호가 비어있거나 활성화된 사용자만
      if (userId && (!currentHash || currentHash.trim() === '') && active === 'Y') {
        sheet.getRange(i + 1, passwordHashCol + 1).setValue(defaultHash);
        updatedCount++;
      }
    }
    
    new LogService().log('전체 비밀번호 초기화', null, currentUser.userId);
    
    return {
      success: true,
      message: `${updatedCount}명의 비밀번호가 초기화되었습니다.`,
      count: updatedCount
    };
  } catch (error) {
    Logger.log('initializeAllPasswords error: ' + error);
    return {
      success: false,
      message: '비밀번호 초기화 중 오류가 발생했습니다: ' + error.message
    };
  }
}

