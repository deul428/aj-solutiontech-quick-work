// ==========================================
// 비즈니스 로직 레이어
// ==========================================

class RequestService {
  constructor() {
    this.requestModel = new RequestModel();
    this.userModel = new UserModel();
    this.logService = new LogService();
  }
  
  // 신청 생성
  createRequest(formData, user) {
    try {
      // 1. 사용자 정보 확인
      if (!user) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      
      // 2. 입력 검증
      this._validateRequestData(formData);
      
      // 3. 중복 접수 체크 (같은 관리번호, 같은 상태가 접수중인 경우)
      const duplicateCheck = this._checkDuplicateRequest(formData, user);
      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          isDuplicate: true,
          duplicateRequestNo: duplicateCheck.requestNo,
          message: `중복 접수가 감지되었습니다. 신청번호: ${duplicateCheck.requestNo}`
        };
      }
      
      // 4. 신청번호 생성
      const requestNo = this._generateRequestNo();
      
      // 4. 사진 업로드
      let photoUrl = '';
      // photoUrl이 data URL 형식이면 base64 추출
      if (formData.photoUrl && formData.photoUrl.startsWith('data:')) {
        // data:image/jpeg;base64,{base64데이터} 형식에서 base64 추출
        const base64Data = formData.photoUrl;
        photoUrl = this._uploadPhoto(requestNo, base64Data);
      } else if (formData.photoBase64) {
        // photoBase64가 직접 전달된 경우
        photoUrl = this._uploadPhoto(requestNo, formData.photoBase64);
      } else if (formData.photoUrl) {
        // 이미 URL 형식인 경우 (Google Drive URL 등)
        photoUrl = formData.photoUrl;
      }
      
      // 5. 데이터 준비
      const requestData = {
        requestNo: requestNo,
        // 날짜/시간 저장 포맷 통일 (KST ISO +09:00)
        requestDate: formatKstIsoDateTime(new Date()),
        requesterEmail: user.userId, // 사용자 ID 사용
        requesterName: user.name,
        employeeCode: user.employeeCode,
        team: user.team,
        region: formData.region || user.region,
        itemName: formData.itemName,
        modelName: formData.modelName || '',
        serialNo: formData.serialNo || '',
        quantity: parseInt(formData.quantity),
        assetNo: formData.assetNo,
        deliveryPlace: formData.deliveryPlace || '',
        phone: formData.phone || '',
        company: formData.company || '',
        remarks: formData.remarks || '',
        photoUrl: photoUrl,
        status: CONFIG.STATUS.REQUESTED,
        handler: '',
        handlerRemarks: '',
        orderDate: '',
        expectedDeliveryDate: '',
        receiptDate: '',
        lastModified: formatKstIsoDateTime(new Date()),
        lastModifiedBy: user.userId
      };
      
      // 6. DB 저장
      this.requestModel.create(requestData);
      
      // 7. 로그 기록
      this.logService.log('신청 생성', requestNo, user.userId);
      
      // 8. 관리자 알림
      if (CONFIG.EMAIL.ADMIN_NOTIFICATION) {
        this._notifyAdmins(requestData);
      }
      
      return { 
        success: true, 
        requestNo: requestNo,
        message: '신청이 완료되었습니다.' 
      };
      
    } catch (error) {
      Logger.log('createRequest error: ' + error);
      this.logService.error('신청 생성 실패', null, user ? user.userId : 'unknown', error.message);
      return { 
        success: false, 
        message: error.message 
      };
    }
  }
  
  // 상태 변경
  updateStatus(requestNo, newStatus, remarks, user) {
    try {
      if (!user) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      
      const request = this.requestModel.findById(requestNo);
      if (!request) {
        throw new Error('신청 건을 찾을 수 없습니다.');
      }
      
      // 권한 체크
      this._checkUpdatePermission(user, request, newStatus);
      
      // 상태 변경
      const updates = {
        status: newStatus,
        lastModified: formatKstIsoDateTime(new Date()),
        lastModifiedBy: user.userId
      };
      
      if (remarks) {
        updates.handlerRemarks = remarks;
      }
      
      // 특정 상태일 때 날짜 기록
      if (newStatus === CONFIG.STATUS.ORDERING) {
        updates.orderDate = formatKstIsoDateTime(new Date());
      }
      
      if (newStatus === CONFIG.STATUS.COMPLETED_CONFIRMED || newStatus === CONFIG.STATUS.COMPLETED_PENDING) {
        if (!request.orderDate) {
          updates.orderDate = formatKstIsoDateTime(new Date());
        }
      }
      
      if (newStatus === CONFIG.STATUS.FINISHED) {
        updates.receiptDate = formatKstIsoDateTime(new Date());
      }
      
      this.requestModel.update(requestNo, updates);
      
      // 로그 기록
      this.logService.log(`상태 변경: ${request.status} → ${newStatus}`, requestNo, user.userId);
      
      // 신청자 알림
      if (CONFIG.EMAIL.USER_NOTIFICATION) {
        this._notifyUser(request, newStatus);
      }
      
      return { 
        success: true, 
        message: '상태가 변경되었습니다.' 
      };
      
    } catch (error) {
      Logger.log('updateStatus error: ' + error);
      return { 
        success: false, 
        message: error.message 
      };
    }
  }
  
  // Private 메서드들
  _validateRequestData(data) {
    if (!data.itemName || data.itemName.trim() === '') {
      throw new Error('품명은 필수 입력 항목입니다.');
    }
    
    if (!data.quantity || parseInt(data.quantity) < 1) {
      throw new Error('수량은 1 이상이어야 합니다.');
    }
    
    if (!data.assetNo || data.assetNo.trim() === '') {
      throw new Error('관리번호는 필수 입력 항목입니다.');
    }
    
    // photoUrl (data URL) 또는 photoBase64 중 하나는 필수
    if (!data.photoUrl && !data.photoBase64) {
      throw new Error('사진 첨부는 필수입니다.');
    }
  }
  
  _checkDuplicateRequest(formData, user) {
    try {
      // 같은 관리번호로 접수중인 신청이 있는지 확인
      const requests = this.requestModel.findAll({
        requesterUserId: user.userId,
        assetNo: formData.assetNo
      });
      
      // requests가 배열이 아닌 경우 처리
      if (!Array.isArray(requests)) {
        Logger.log('_checkDuplicateRequest: findAll returned non-array: ' + typeof requests);
        return { isDuplicate: false };
      }
      
      // 접수중 상태인 신청 찾기
      const duplicateRequest = requests.find(req => {
        return req.status === CONFIG.STATUS.REQUESTED;
      });
      
      if (duplicateRequest) {
        return {
          isDuplicate: true,
          requestNo: duplicateRequest.requestNo
        };
      }
      
      return { isDuplicate: false };
    } catch (error) {
      Logger.log('_checkDuplicateRequest error: ' + error);
      // 에러 발생 시 중복이 아닌 것으로 처리 (신청 진행 허용)
      return { isDuplicate: false };
    }
  }
  
  _generateRequestNo() {
    const today = new Date();
    const prefix = Utilities.formatDate(today, 'Asia/Seoul', 'yyMMdd');
    
    const requests = this.requestModel.findAll();
    const todayRequests = requests.filter(r => {
      if (!r.requestNo) return false;
      // requestNo를 문자열로 변환하여 비교
      const requestNoStr = String(r.requestNo);
      return requestNoStr.startsWith(prefix);
    });
    
    let sequence = 1;
    if (todayRequests.length > 0) {
      const lastNo = String(todayRequests[todayRequests.length - 1].requestNo);
      sequence = parseInt(lastNo.substr(6)) + 1;
    }
    
    return prefix + String(sequence).padStart(4, '0');
  }
  
  _uploadPhoto(requestNo, base64Data) {
    try {
      let folderId = getProperty('DRIVE_FOLDER_ID') || CONFIG.DRIVE_FOLDER_ID;
      
      // 폴더가 없으면 자동으로 생성
      if (!folderId) {
        Logger.log('Drive folder not found, creating new folder...');
        try {
          const folder = DriveApp.createFolder('부품발주_사진첨부');
          
          // 폴더 공유 설정 (링크가 있는 사람은 볼 수 있음)
          try {
            folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (sharingError) {
            Logger.log('Folder sharing setting failed: ' + sharingError);
            // 공유 설정 실패해도 계속 진행
          }
          
          folderId = folder.getId();
          
          // Properties에 저장
          setProperty('DRIVE_FOLDER_ID', folderId);
          CONFIG.DRIVE_FOLDER_ID = folderId;
          
          Logger.log('Drive folder created successfully: ' + folderId);
        } catch (createError) {
          Logger.log('Failed to create drive folder: ' + createError);
          throw new Error('Drive 폴더 생성에 실패했습니다: ' + createError.message);
        }
      }
      
      let folder;
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (folderError) {
        Logger.log('Failed to get folder by ID, trying to recreate: ' + folderError);
        // 폴더 ID가 유효하지 않으면 다시 생성
        const newFolder = DriveApp.createFolder('부품발주_사진첨부');
        try {
          newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e) {}
        folderId = newFolder.getId();
        setProperty('DRIVE_FOLDER_ID', folderId);
        CONFIG.DRIVE_FOLDER_ID = folderId;
        folder = newFolder;
        Logger.log('Drive folder recreated: ' + folderId);
      }
      
      // Base64 디코드
      // data URL 형식 (data:image/jpeg;base64,{data}) 또는 순수 base64
      let contentType = 'image/jpeg'; // 기본값
      let data = base64Data;
      
      if (base64Data.startsWith('data:')) {
        // data URL 형식인 경우
        const parts = base64Data.split(',');
        const header = parts[0]; // data:image/jpeg;base64
        data = parts[1]; // 실제 base64 데이터
        
        // content type 추출
        if (header.includes('image/png')) {
          contentType = 'image/png';
        } else if (header.includes('image/jpeg') || header.includes('image/jpg')) {
          contentType = 'image/jpeg';
        } else if (header.includes('image/gif')) {
          contentType = 'image/gif';
        } else {
          // header에서 직접 추출 시도
          const typeMatch = header.match(/data:([^;]+)/);
          if (typeMatch && typeMatch[1]) {
            contentType = typeMatch[1];
          }
        }
      }
      
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data),
        contentType,
        requestNo + '_' + new Date().getTime() + '.jpg'
      );
      
      // Drive에 업로드
      const file = folder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingError) {
        Logger.log('File sharing setting failed: ' + sharingError);
        // 공유 설정 실패해도 계속 진행
      }
      
      return file.getUrl();
      
    } catch (error) {
      Logger.log('Photo upload error: ' + error);
      Logger.log('Photo upload error stack: ' + error.stack);
      throw new Error('사진 업로드에 실패했습니다: ' + error.message);
    }
  }
  
  _checkUpdatePermission(user, request, newStatus) {
    // 관리자는 모든 변경 가능
    if (user.role === CONFIG.ROLES.ADMIN) {
      return;
    }
    
    // 신청자는 '접수중' 상태만 취소 가능
    if (user.userId === request.requesterEmail) {
      if (request.status === CONFIG.STATUS.REQUESTED && 
          newStatus === CONFIG.STATUS.CANCELLED) {
        return;
      }
      
      // 발주완료 상태에서 처리완료로 변경 (수령 확인)
      if ((request.status === CONFIG.STATUS.COMPLETED_CONFIRMED || request.status === CONFIG.STATUS.COMPLETED_PENDING) && 
          newStatus === CONFIG.STATUS.FINISHED) {
        return;
      }
    }
    
    throw new Error('상태를 변경할 권한이 없습니다.');
  }
  
  _notifyAdmins(request) {
    try {
      const admins = this.userModel.findAllAdmins();
      
      admins.forEach(admin => {
        // admin.userId가 이메일 형식일 수도 있으므로 그대로 사용
        const adminEmail = admin.userId.includes('@') ? admin.userId : admin.userId + '@example.com';
        MailApp.sendEmail({
          to: adminEmail,
          subject: '[부품발주] 신규 신청 - ' + request.requestNo,
          body: `신규 부품 발주 신청이 접수되었습니다.\n\n` +
                `신청번호: ${request.requestNo}\n` +
                `신청자: ${request.requesterName} (${request.team})\n` +
                `품명: ${request.itemName}\n` +
                `수량: ${request.quantity}\n` +
                `관리번호: ${request.assetNo}\n\n` +
                `시스템에서 확인해주세요.`,
          name: CONFIG.EMAIL.FROM_NAME
        });
      });
    } catch (error) {
      Logger.log('Admin notification failed: ' + error);
    }
  }
  
  _notifyUser(request, newStatus) {
    try {
      const statusMessages = {
        [CONFIG.STATUS.ORDERING]: '발주가 진행 중입니다.',
        [CONFIG.STATUS.COMPLETED_CONFIRMED]: '발주가 완료되었습니다. (납기확인) 수령 확인을 부탁드립니다.',
        [CONFIG.STATUS.COMPLETED_PENDING]: '발주가 완료되었습니다. (납기미정)',
        [CONFIG.STATUS.FINISHED]: '처리가 완료되었습니다.',
        [CONFIG.STATUS.CANCELLED]: '신청이 취소되었습니다.'
      };
      
      const message = statusMessages[newStatus];
      if (message) {
        // requesterEmail이 이메일 형식일 수도 있고 사용자 ID일 수도 있음
        const userEmail = request.requesterEmail.includes('@') ? request.requesterEmail : request.requesterEmail + '@example.com';
        MailApp.sendEmail({
          to: userEmail,
          subject: '[부품발주] 상태 변경 - ' + request.requestNo,
          body: `신청하신 부품 발주 건의 상태가 변경되었습니다.\n\n` +
                `신청번호: ${request.requestNo}\n` +
                `품명: ${request.itemName}\n` +
                `상태: ${newStatus}\n` +
                `${message}\n\n` +
                `담당자 비고: ${request.handlerRemarks || '없음'}`,
          name: CONFIG.EMAIL.FROM_NAME
        });
      }
    } catch (error) {
      Logger.log('User notification failed: ' + error);
    }
  }
}

class LogService {
  constructor() {
    this.sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.LOGS);
  }
  
  log(action, requestNo, userEmail, details = '') {
    this.sheet.appendRow([
      // 로그 시간도 통일 포맷으로 저장
      formatKstIsoDateTime(new Date()),
      'INFO',
      action,
      requestNo || '',
      userEmail,
      details
    ]);
  }
  
  error(action, requestNo, userEmail, errorMessage) {
    this.sheet.appendRow([
      // 로그 시간도 통일 포맷으로 저장
      formatKstIsoDateTime(new Date()),
      'ERROR',
      action,
      requestNo || '',
      userEmail,
      errorMessage
    ]);
  }
}

