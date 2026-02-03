/**
 * 부품발주 시스템 인증 유틸리티
 */

import { User } from '../types/ordering'; 

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
 */
export function isAdmin(user: User | null): boolean {
  if (!user || !user.role) return false;
  const role = String(user.role).toLowerCase();
  return role.includes('관리자') || role.includes('console');
}

/**
 * 사용자 권한 확인
 */
export function isUser(user: User | null): boolean {
  if (!user || !user.role) return false;
  const role = String(user.role).toLowerCase();
  return role.includes('사용자') || role.includes('user') || role.includes('신청자');
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

