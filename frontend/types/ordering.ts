// 사용자 타입
export interface User {
  userId: string;
  name: string;
  team: string;
  region: string;
  /**
   * UI/레거시용 역할: 둘 중 하나라도 관리자면 '관리자', 아니면 '신청자'
   */
  role: '신청자' | '관리자';
  /**
   * 시스템별 역할
   * - orderingRole: 부품발주 권한 기준
   * - auditRole: 정비 체크리스트/자산실사 권한 기준
   */
  orderingRole?: '신청자' | '관리자' | string;
  auditRole?: '신청자' | '관리자' | string;
  employeeCode?: string;
  active?: string;
}

// 신청 타입
export interface Request {
  requestNo: string;
  requestDate: string;
  // 신규: 신청자 식별자는 사용자ID 기준
  requesterUserId?: string;
  // 하위 호환성: 과거에는 requesterEmail에 사용자ID가 들어오기도 했음
  requesterEmail?: string;
  requesterName: string;
  employeeCode?: string;
  team: string;
  region: string;
  itemName: string;
  modelName?: string;
  serialNo?: string;
  quantity: number;
  assetNo?: string;
  deliveryPlace: string;
  phone?: string;
  company?: string;
  remarks?: string;
  photoUrl?: string;
  status: string;
  handler?: string;
  handlerRemarks?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  receiptDate?: string;
  lastModified?: string;
  lastModifiedBy?: string;
  canCancel?: boolean;
  canConfirmReceipt?: boolean;
}

// 통계 타입
export interface RequestStats {
  requested: number;
  inProgress: number;
  completed: number;
  total: number;
}

// 대시보드 데이터 타입
export interface DashboardData {
  success: boolean;
  stats: RequestStats;
  recentRequests: Request[];
  notifications: Notification[];
}

// 알림 타입
export interface Notification {
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  date: string;
  requestNo?: string;
}

// 배송지 타입
export interface DeliveryPlace {
  name: string;
  '배송지명': string;
  team: string;
  address: string;
  contact: string;
}

// 지역-팀 타입
export interface RegionTeam {
  region: string;
  team: string;
  active: 'Y' | 'N';
}

