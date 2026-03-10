// ==========================================
// 트리거 및 자동화
// ==========================================

/**
 * 모든 자동화 트리거를 설정합니다.
 * - 매일 새벽 2시 백업
 * - 매시간 발주 지연 체크
 * - 매일 오전 9시 일일 리포트
 */
function setupAllTriggers() {
  // 기존 트리거 전체 삭제
  deleteAllTriggers();
  
  // 1. 매일 새벽 2시 백업
  ScriptApp.newTrigger('performDailyBackup')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();
  
  // 2. 매시간 상태 체크 (지연 알림)
  ScriptApp.newTrigger('checkDelayedRequests')
    .timeBased()
    .everyHours(1)
    .create();
  
  // 3. 매일 오전 9시 일일 리포트
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  
  Logger.log('All triggers configured successfully');
}

/**
 * 모든 트리거를 삭제합니다.
 * @param {string|null} functionName - 특정 함수의 트리거만 삭제하려면 함수 이름 지정 (선택사항)
 */
function deleteAllTriggers(functionName = null) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (!functionName || trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// 매일 백업 수행
function performDailyBackup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const backupFolderId = getProperty('BACKUP_FOLDER_ID');
    
    if (!backupFolderId) {
      // 백업 폴더 생성
      const backupFolder = DriveApp.createFolder('부품발주_백업');
      setProperty('BACKUP_FOLDER_ID', backupFolder.getId());
      try {
        backupFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {
        Logger.log('Backup folder sharing setting failed: ' + e);
      }
    }
    
    const backupFolder = DriveApp.getFolderById(getProperty('BACKUP_FOLDER_ID'));
    
    // 스프레드시트 복사
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    const backupName = `부품발주_백업_${today}`;
    const backup = ss.copy(backupName);
    
    // 백업 폴더로 이동
    DriveApp.getFileById(backup.getId()).moveTo(backupFolder);
    
    // 30일 이전 백업 삭제
    deleteOldBackups(backupFolder, 30);
    
    Logger.log('Daily backup completed: ' + backupName);
    
  } catch (error) {
    Logger.log('Backup failed: ' + error);
    sendErrorNotification('백업 실패', error.message);
  }
}

function deleteOldBackups(folder, daysToKeep) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().startsWith('부품발주_백업_') && 
        file.getDateCreated() < cutoffDate) {
      file.setTrashed(true);
    }
  }
}

// 지연 건 체크 및 알림
function checkDelayedRequests() {
  try {
    const requestModel = new RequestModel();
    const requests = requestModel.findAll({
      status: CONFIG.STATUS.ORDERING
    });
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const delayedRequests = requests.filter(req => {
      if (!req.orderDate) return false;
      const orderDate = new Date(req.orderDate);
      return orderDate < threeDaysAgo;
    });
    
    if (delayedRequests.length > 0) {
      notifyDelayedRequests(delayedRequests);
    }
  } catch (error) {
    Logger.log('checkDelayedRequests error: ' + error);
  }
}

function notifyDelayedRequests(requests) {
  const admins = new UserModel().findAllAdmins();
  
  requests.forEach(req => {
    admins.forEach(admin => {
      try {
        // admin.userId가 이메일 형식일 수도 있으므로 그대로 사용
        const adminEmail = admin.userId && admin.userId.includes('@') ? admin.userId : (admin.userId || '') + '@example.com';
        MailApp.sendEmail({
          to: adminEmail,
          subject: '[부품발주] 발주 지연 알림 - ' + req.requestNo,
          body: `발주가 3일 이상 지연된 건이 있습니다.\n\n` +
                `신청번호: ${req.requestNo}\n` +
                `품명: ${req.itemName}\n` +
                `신청자: ${req.requesterName}\n` +
                `발주일시: ${formatDate(req.orderDate)}\n\n` +
                `확인 부탁드립니다.`,
          name: CONFIG.EMAIL.FROM_NAME
        });
      } catch (error) {
        Logger.log('Delayed notification failed: ' + error);
      }
    });
  });
}

/**
 * 일일 신청 현황 리포트를 관리자에게 이메일로 전송합니다.
 * 매일 오전 9시에 자동 실행됩니다.
 */
function sendDailyReport() {
  try {
    const requestModel = new RequestModel();
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    
    const requests = requestModel.findAll();
    const todayRequests = requests.filter(req => {
      const reqDate = Utilities.formatDate(new Date(req.requestDate), 'Asia/Seoul', 'yyyy-MM-dd');
      return reqDate === today;
    });
    
    const stats = {
      total: todayRequests.length,
      byStatus: {}
    };
    
    todayRequests.forEach(req => {
      stats.byStatus[req.status] = (stats.byStatus[req.status] || 0) + 1;
    });
    
    // 관리자들에게 리포트 전송
    const admins = new UserModel().findAllAdmins();
    admins.forEach(admin => {
      try {
        // admin.userId가 이메일 형식일 수도 있으므로 그대로 사용
        const adminEmail = admin.userId && admin.userId.includes('@') ? admin.userId : (admin.userId || '') + '@example.com';
        MailApp.sendEmail({
          to: adminEmail,
          subject: '[부품발주] 일일 리포트 - ' + today,
          body: `일일 신청 현황 리포트\n\n` +
                `날짜: ${today}\n` +
                `전체 신청: ${stats.total}건\n\n` +
                `상태별 현황:\n` +
                Object.entries(stats.byStatus).map(([status, count]) => 
                  `  ${status}: ${count}건`
                ).join('\n'),
          name: CONFIG.EMAIL.FROM_NAME
        });
      } catch (error) {
        Logger.log('Daily report failed: ' + error);
      }
    });
  } catch (error) {
    Logger.log('sendDailyReport error: ' + error);
  }
}

/**
 * 시스템 에러 발생 시 관리자에게 알림을 전송합니다.
 * @param {string} errorType - 에러 유형
 * @param {string} errorMessage - 에러 메시지
 * @param {Object} context - 추가 컨텍스트 정보 (선택사항)
 */
function sendErrorNotification(errorType, errorMessage, context = {}) {
  try {
    const admins = new UserModel().findAllAdmins();
    
    const subject = `[부품발주시스템] 에러 발생: ${errorType}`;
    const body = `시스템 에러가 발생했습니다.\n\n` +
                 `에러 유형: ${errorType}\n` +
                 `에러 메시지: ${errorMessage}\n` +
                 `발생 시각: ${new Date().toISOString()}\n` +
                 `컨텍스트:\n${JSON.stringify(context, null, 2)}\n\n` +
                 `시스템을 확인해 주세요.`;
    
    admins.forEach(admin => {
      try {
        // admin.userId가 이메일 형식일 수도 있으므로 그대로 사용
        const adminEmail = admin.userId && admin.userId.includes('@') ? admin.userId : (admin.userId || '') + '@example.com';
        MailApp.sendEmail({
          to: adminEmail,
          subject: subject,
          body: body,
          name: CONFIG.EMAIL.FROM_NAME
        });
      } catch (e) {
        Logger.log('Failed to send error notification: ' + e);
      }
    });
  } catch (error) {
    Logger.log('sendErrorNotification failed: ' + error);
  }
}

