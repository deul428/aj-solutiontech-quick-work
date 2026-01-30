/**
 * 부품발주 시스템 요청 데이터 캐시 유틸리티
 * 메모리 기반 캐시로 상세 페이지 로딩 속도 개선
 */

import { Request } from '../types/ordering';

class RequestCache {
  private cache: Map<string, Request>;
  private maxSize: number;
  private accessOrder: string[]; // LRU를 위한 접근 순서

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  /**
   * 캐시에 데이터 저장
   */
  set(requestNo: string, request: Request): void {
    // 이미 존재하면 업데이트
    if (this.cache.has(requestNo)) {
      this.cache.set(requestNo, request);
      this.updateAccessOrder(requestNo);
      return;
    }

    // 최대 크기 초과 시 LRU 방식으로 제거
    if (this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(requestNo, request);
    this.accessOrder.push(requestNo);
  }

  /**
   * 캐시에서 데이터 조회
   */
  get(requestNo: string): Request | undefined {
    const request = this.cache.get(requestNo);
    if (request) {
      this.updateAccessOrder(requestNo);
    }
    return request;
  }

  /**
   * 캐시에 데이터가 있는지 확인
   */
  has(requestNo: string): boolean {
    return this.cache.has(requestNo);
  }

  /**
   * 여러 요청을 한 번에 저장
   */
  setMany(requests: Request[]): void {
    requests.forEach(request => {
      if (request.requestNo) {
        this.set(request.requestNo, request);
      }
    });
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * 캐시 크기 반환
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 접근 순서 업데이트 (LRU)
   */
  private updateAccessOrder(requestNo: string): void {
    const index = this.accessOrder.indexOf(requestNo);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(requestNo);
  }
}

// 싱글톤 인스턴스
const requestCache = new RequestCache(100);

export default requestCache;

