/**
 * 부품발주 시스템 인증 유틸리티
 */

import { User } from '../types/ordering'; 

type UiRole = 'manager' | 'user';

function isAdminLike_(value: unknown): boolean {
  const role = String(value ?? '').trim().toLowerCase();
  if (!role) return false;
  return role.includes('관리자') || role.includes('manager');
}

function isUserLike_(value: unknown): boolean {
  const role = String(value ?? '').trim().toLowerCase();
  if (!role) return false;
  return role.includes('사용자') || role.includes('user') || role.includes('신청자');
}

/**
 * 현재 사용자 가져오기
 */
export function getCurrentUser(): User | null {
  return getStoredUser();
}

/**
 * 세션 토큰 가져오기
 */
export function getSessionToken(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return sessionStorage.getItem('ordering_session_token');
  }
  return null;
}

/**
 * 사용자 정보 저장
 */
export function setCurrentUser(user: User, sessionToken: string): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.setItem('ordering_current_user', JSON.stringify(user));
    sessionStorage.setItem('ordering_session_token', sessionToken);
  }
}

/**
 * 저장된 사용자 정보 가져오기
 */
export function getStoredUser(): User | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const stored = sessionStorage.getItem('ordering_current_user');
    if (stored) {
      try {
        return JSON.parse(stored) as User;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

/**
 * 로그인 상태 확인
 */
export function isLoggedIn(): boolean {
  const user = getStoredUser();
  const token = getSessionToken();
  return !!(user && token);
}

/**
 * 로그아웃
 */
export function logout(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.removeItem('ordering_current_user');
    sessionStorage.removeItem('ordering_session_token'); 
  }
}

/**
 * 세션 초기화 (더 이상 사용하지 않음)
 */
export function initSession(): void {
  // 로그인 필요하므로 초기화하지 않음
}

/**
 * 관리자 권한 확인
 * - UI/레거시용: orderingRole/auditRole 중 하나라도 관리자면 관리자(any_admin)
 */
export function isAdmin(user: User | null): boolean {
  if (!user) return false;
  return getUiRole(user) === 'manager';
}

/**
 * 사용자 권한 확인
 * - UI/레거시용: any_admin 규칙의 반대
 */
export function isUser(user: User | null): boolean {
  if (!user) return false;
  return getUiRole(user) === 'user';
}

/**
 * UI/레거시 호환 역할 반환
 * - orderingRole/auditRole 중 하나라도 관리자면 'manager'
 * - 둘 다 관리자 아니면 'user'
 */
export function getUiRole(user: User | null): UiRole {
  if (!user) return 'user';
  if (isAdminLike_(user.orderingRole) || isAdminLike_(user.auditRole)) return 'manager';
  // 구버전 세션/데이터 fallback
  if (isAdminLike_(user.role)) return 'manager';
  return 'user';
}

/**
 * 부품발주 시스템 관리자 여부 (권한 체크용)
 * - orderingRole이 있으면 그것을 우선 사용
 * - 없으면 레거시 role로 fallback
 */
export function isOrderingAdmin(user: User | null): boolean {
  if (!user) return false;
  return isAdminLike_(user.orderingRole ?? user.role);
}

/**
 * 정비 체크리스트/자산실사 시스템 관리자 여부 (권한 체크용)
 * - auditRole이 있으면 그것을 우선 사용
 * - 없으면 레거시 role로 fallback
 */
export function isAuditAdmin(user: User | null): boolean {
  if (!user) return false;
  return isAdminLike_(user.auditRole ?? user.role);
}

/**
 * 특정 역할 확인
 */
export function hasRole(user: User | null, role: string): boolean {
  if (!user || !user.role) return false;
  const userRole = String(user.role).toLowerCase();
  const targetRole = role.toLowerCase();
  return userRole.includes(targetRole);
}

