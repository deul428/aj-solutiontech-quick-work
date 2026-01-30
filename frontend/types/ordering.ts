// 사용자 타입
export interface User {
  userId: string;
  name: string;
  team: string;
  region: string;
  role: '신청자' | '관리자';
  employeeCode?: string;
  active?: string;
}

// 신청 타입
export interface Request {
  requestNo: string;
  requestDate: string;
  requesterEmail: string;
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

