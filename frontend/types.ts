
export interface MasterDataRow {
  [key: string]: any;
  '자산실사일'?: string;
  '자산실사 여부'?: string;
  '센터위치'?: string;
  '자산위치'?: string;
}

export interface ChecklistData {
  mgmtNumber: string;
  productCode: string;
  productName: string;
  manufacturer: string;
  model: string;
  year: string;
  usageTime: string;
  assetNumber: string;
  vehicleNumber: string;
  serialNumber: string;
  category: '물류' | '건설' | null;
  qrBase64?: string; // 클라우드 저장용 QR 이미지 데이터
}

/**
 * 마스터파일(읽기전용)의 헤더 매핑
 */
export const MASTER_COLUMNS = {
  MGMT_NO: '관리번호',
  PROD_NO: '자재번호',
  PROD_NAME: '자재내역',
  MANUFACTURER: '제조사명',
  MODEL_NAME: '제조사모델명',
  PROD_YEAR: '제조년도',
  ASSET_NO: '자산번호',
  VEHICLE_NO: '차량번호',
  SERIAL_NO: '시리얼번호',
  EQUIP_STATUS: '장비상태'
};

/**
 * 체크리스트_데이터(저장/업데이트용)의 헤더 매핑
 */
export const CHECKLIST_COLUMNS = {
  MGMT_NO: '관리번호',
  ASSET_NO: '자산번호',
  PROD_CODE: '상품코드',
  PROD_NAME: '상품명',
  MANUFACTURER: '제조사',
  MODEL: '모델',
  YEAR: '년식',
  VEHICLE_NO: '차량번호',
  SERIAL_NO: '차대번호',
  AUDIT_DATE: '자산실사일',
  AUDIT_STATUS: '자산실사 여부',
  QR: 'QR',
  CENTER_LOC: '센터위치',
  ASSET_LOC: '자산위치'
};

/**
 * 자산 실사 데이터 업데이트를 위한 컬럼 매핑 (AuditPage에서 사용)
 */
export const AUDIT_COLUMNS = {
  STATUS: '자산실사 여부',
  DATE: '자산실사일',
  CENTER: '센터위치',
  ZONE: '자산위치'
};
