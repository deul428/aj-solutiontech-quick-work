/**
 * 부품발주 시스템 API 서비스
 * st_checklist의 excelService.ts 패턴을 따름
 */

import { User, Request, DashboardData, DeliveryPlace, RequestStats } from '../types/ordering';
import { getSessionToken } from '../utils/orderingAuth';
import ExcelJS from 'exceljs';

/**
 * 기본 구글 앱스 스크립트 배포 URL (부품발주 시스템)
 * 환경 변수에서 가져오거나 기본값 사용
 */
export const ORDERING_GAS_URL = (import.meta.env?.VITE_ORDERING_GAS_URL as string) || "https://script.google.com/macros/s/AKfycbx5AfI7xiJLaWSmZ4Yq8p7Sq6R_LJ80ZXqCSfR7-kIOOrboAkZxDSjk_EFoixIWUwJ6/exec";

/**
 * GET 요청 헬퍼 함수
 */
/**
 * GET 요청 헬퍼 함수
 */
async function fetchOrderingData<T = any>(
    url: string,
    action: string,
    params: Record<string, any> = {}
): Promise<T> {
    try {
        const getUrlSeparator = (url: string): string => url.includes('?') ? '&' : '?';
        const separator = getUrlSeparator(url);
        const paramString = Object.keys(params)
            .filter(key => params[key] !== null && params[key] !== undefined)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
        const fetchUrl = `${url}${separator}action=${action}${paramString ? '&' + paramString : ''}&t=${Date.now()}`;


        const response = await fetch(fetchUrl, {
            redirect: 'follow' // 리다이렉트 자동 따라가기
        });
        // 302는 리다이렉트 중간 상태이므로, 최종 응답 확인
        // fetch는 자동으로 리다이렉트를 따라가므로 최종 상태 코드 확인
        if (response.status >= 400) {
            const errorText = await response.text();
            console.error(`[fetchOrderingData] HTTP error! status: ${response.status}`, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 응답을 먼저 텍스트로 읽어서 확인
        const responseText = await response.text();

        // 빈 응답 체크
        if (!responseText || responseText.trim() === '') {
            console.warn(`[fetchOrderingData] Empty response for action: ${action}`);
            // 빈 응답인 경우 빈 배열 반환 (하위 호환성)
            return [] as T;
        }

        // JSON 파싱 시도
        try {
            const data = JSON.parse(responseText);
            // 에러 응답 체크 (서버가 에러를 객체로 반환하는 경우)
            if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
                const errorMsg = data.error || '서버에서 오류가 발생했습니다.';
                console.error(`[fetchOrderingData] Server returned error:`, data);
                throw new Error(errorMsg);
            }

            // success: false 체크
            if (data && typeof data === 'object' && 'success' in data && data.success === false) {
                const errorMsg = data.error || data.message || '요청이 실패했습니다.';
                console.error(`[fetchOrderingData] Server returned success: false:`, data);
                throw new Error(errorMsg);
            }

            return data as T;
        } catch (parseError: any) {
            console.error(`[fetchOrderingData] JSON parse error for action ${action}:`, parseError);
            console.error(`[fetchOrderingData] Full response text:`, responseText);
            throw new Error(`Failed to parse JSON response for ${action}: ${parseError.message || parseError}`);
        }
    } catch (error) {
        console.error(`[fetchOrderingData] Error fetching ${action}:`, error);
        throw error;
    }
}

/**
 * POST 요청 헬퍼 함수
 * - 실제로는 POST + text/plain(JSON 문자열)로 전송하여
 *   - URL 길이 제한 문제를 피하고
 *   - CORS preflight(OPTIONS)를 발생시키지 않도록 함
 */
async function postOrderingData<T = any>(
    url: string,
    action: string,
    payload: Record<string, any> = {}
): Promise<T> {
    try {
        const requestBody = {
            action,
            ...payload
        };

        const bodyString = JSON.stringify(requestBody);

        const response = await fetch(url, {
            method: 'POST',
            redirect: 'follow',
            // text/plain 은 CORS simple request 이므로 preflight 없이 전송 가능
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: bodyString
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP error! status: ${response.status}`, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 응답을 먼저 텍스트로 읽어서 확인
        const responseText = await response.text();

        // 빈 응답 체크
        if (!responseText || responseText.trim() === '') {
            console.warn(`[postOrderingData] Empty response for action: ${action}`);
            throw new Error(`Empty response from server for action: ${action}`);
        }

        // JSON 파싱 시도
        try {
            const data = JSON.parse(responseText);
            return data as T;
        } catch (parseError: any) {
            console.error(`[postOrderingData] JSON parse error for action ${action}:`, parseError);
            console.error(`[postOrderingData] Full response text:`, responseText);
            throw new Error(`Failed to parse JSON response for ${action}: ${parseError.message || parseError}`);
        }
    } catch (error: any) {
        console.error(`Error posting ${action}:`, error);
        // 에러 메시지에 더 많은 정보 포함
        if (error.message) {
            throw new Error(`Failed to post ${action}: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 현재 사용자 정보 조회
 */
export async function getCurrentUserOrdering(
    url: string,
    sessionToken: string
): Promise<User | null> {
    try {
        const result = await fetchOrderingData<{ success?: boolean } & User>(
            url,
            'getCurrentUser',
            { token: sessionToken }
        );

        // result가 User 객체이거나 { success: true, ...user } 형태일 수 있음
        if (result && (result as any).userId) {
            return result as User;
        }
        return null;
    } catch (error) {
        console.error('Failed to get current user:', error);
        return null;
    }
}

/**
 * 페이징 결과 타입
 */
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * 내 신청 목록 조회 (페이징 지원)
 */
export async function getMyRequestsOrdering(
    url: string,
    filter: {
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        pageSize?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    } = {},
    sessionToken: string
): Promise<Request[] | PaginatedResult<Request>> {
    try {
        const result = await fetchOrderingData<Request[] | PaginatedResult<Request>>(
            url,
            'getMyRequests',
            {
                ...filter,
                token: sessionToken
            }
        );

        // 페이징 결과인 경우
        if (result && typeof result === 'object' && 'data' in result) {
            return result as PaginatedResult<Request>;
        }

        // 배열 결과인 경우 (하위 호환성)
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error('Failed to get my requests:', error);
        throw error;
    }
}

/**
 * 전체 신청 목록 조회 (관리자 전용, 페이징 지원)
 * ordering_gas_url과 연결된 구글 시트 내 '신청내역' 시트 데이터 조회
 */
export async function getAllRequestsOrdering(
    url: string,
    filter: {
        status?: string;
        region?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        pageSize?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    } = {},
    sessionToken: string
): Promise<Request[] | PaginatedResult<Request>> {
    try {
        const result = await fetchOrderingData<Request[] | PaginatedResult<Request>>(
            url,
            'getAllRequests',
            {
                ...filter,
                token: sessionToken
            }
        );

        // 페이징 결과인 경우
        if (result && typeof result === 'object' && 'data' in result) {
            const paginatedResult = result as PaginatedResult<Request>;
            return paginatedResult;
        }

        // 배열 결과인 경우 (하위 호환성)
        const arrayResult = Array.isArray(result) ? result : [];
        return arrayResult;
    } catch (error) {
        console.error('[getAllRequestsOrdering] Failed to get all requests:', error);
        throw error;
    }
}

/**
 * 신청 상세 조회
 */
export async function getRequestOrdering(
    url: string,
    requestNo: string,
    sessionToken: string
): Promise<Request | null> {
    try {
        const result = await fetchOrderingData<Request>(
            url,
            'getRequest',
            {
                requestNo,
                token: sessionToken
            }
        );

        if (result && (result as any).requestNo) {
            return result as Request;
        }
        return null;
    } catch (error) {
        console.error('Failed to get request:', error);
        return null;
    }
}

/**
 * 신청 상세 조회 (getRequestDetail)
 */
export async function getRequestDetailOrdering(
    url: string,
    requestNo: string,
    sessionToken: string
): Promise<Request | null> {
    try {
        const result = await fetchOrderingData<Request>(
            url,
            'getRequestDetail',
            {
                requestNo,
                token: sessionToken
            }
        );

        if (result && (result as any).requestNo) {
            return result as Request;
        }
        return null;
    } catch (error) {
        console.error('Failed to get request detail:', error);
        return null;
    }
}

/**
 * 대시보드 데이터 조회
 */
export async function getDashboardDataOrdering(
    url: string,
    sessionToken: string
): Promise<DashboardData> {
    const result = await fetchOrderingData<DashboardData>(
        url,
        'getDashboardData',
        { token: sessionToken }
    );

    if (result && (result as any).success !== false) {
        return result as DashboardData;
    }
    
    // success: false인 경우 에러 throw
    throw new Error('대시보드 데이터를 불러올 수 없습니다.');
}

/**
 * 신청 통계 조회
 */
export async function getRequestStatsOrdering(
    url: string,
    sessionToken: string
): Promise<RequestStats> {
    try {
        const result = await fetchOrderingData<RequestStats>(
            url,
            'getRequestStats',
            { token: sessionToken }
        );

        if (result && typeof result === 'object') {
            return result as RequestStats;
        }
        return { requested: 0, inProgress: 0, completed: 0, total: 0 };
    } catch (error) {
        console.error('Failed to get request stats:', error);
        return { requested: 0, inProgress: 0, completed: 0, total: 0 };
    }
}

/**
 * 배송지 목록 조회
 */
export async function getDeliveryPlacesOrdering(
    url: string,
    team: string | null,
    sessionToken: string
): Promise<DeliveryPlace[]> {
    try {
        const params: Record<string, any> = { token: sessionToken };
        if (team) {
            params.team = team;
        }

        const result = await fetchOrderingData<DeliveryPlace[]>(
            url,
            'getDeliveryPlaces',
            params
        );

        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error('Failed to get delivery places:', error);
        return [];
    }
}

/**
 * 전체 배송지 목록 조회
 */
export async function getAllDeliveryPlacesOrdering(
    url: string,
    sessionToken: string
): Promise<DeliveryPlace[]> {
    try {
        const result = await fetchOrderingData<DeliveryPlace[]>(
            url,
            'getAllDeliveryPlaces',
            { token: sessionToken }
        );

        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error('Failed to get all delivery places:', error);
        return [];
    }
}

/**
 * 신청 등록
 */
export async function createRequestOrdering(
    url: string,
    formData: {
        itemName: string;
        modelName?: string;
        serialNo?: string;
        quantity: number;
        assetNo: string;
        deliveryPlace: string;
        phone?: string;
        company?: string;
        remarks?: string;
        photoUrl?: string;
    },
    sessionToken: string
): Promise<{ success: boolean; message?: string; requestNo?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string; requestNo?: string }>(
            url,
            'createRequest',
            {
                formData,
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to create request:', error);
        return {
            success: false,
            message: error.message || '신청 처리 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 신청 취소
 */
export async function cancelRequestOrdering(
    url: string,
    requestNo: string,
    sessionToken: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'cancelRequest',
            {
                requestNo,
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to cancel request:', error);
        return {
            success: false,
            message: error.message || '취소 처리 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 수령 확인
 */
export async function confirmReceiptOrdering(
    url: string,
    requestNo: string,
    sessionToken: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'confirmReceipt',
            {
                requestNo,
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to confirm receipt:', error);
        return {
            success: false,
            message: error.message || '수령 확인 처리 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 비밀번호 변경
 */
export async function changePasswordOrdering(
    url: string,
    oldPassword: string,
    newPassword: string,
    sessionToken: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'changePassword',
            {
                oldPassword,
                newPassword,
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to change password:', error);
        return {
            success: false,
            message: error.message || '비밀번호 변경 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 로그인
 */
export async function loginOrdering(
    url: string,
    userId: string,
    password: string
): Promise<{ success: boolean; message?: string; sessionToken?: string; user?: User }> {
    try {
        const result = await postOrderingData<{
            success: boolean;
            message?: string;
            sessionToken?: string;
            user?: User
        }>(
            url,
            'login',
            {
                userId,
                password
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to login:', error);
        return {
            success: false,
            message: error.message || '로그인 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 로그아웃
 */
export async function logoutOrdering(
    url: string,
    sessionToken: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'logout',
            {
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to logout:', error);
        return {
            success: false,
            message: error.message || '로그아웃 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 신청 상태 변경 (관리자 전용)
 */
export async function updateRequestStatusOrdering(
    url: string,
    requestNo: string,
    newStatus: string,
    remarks?: string,
    handler?: string,
    expectedDeliveryDate?: string,
    sessionToken?: string,
    requesterRemarks?: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const token = sessionToken || getSessionToken();
        if (!token) {
            return {
                success: false,
                message: '세션 토큰이 필요합니다.'
            };
        }

        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'updateRequestStatus',
            {
                requestNo,
                newStatus,
                remarks,
                handler,
                expectedDeliveryDate,
                requesterRemarks,
                token
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to update request status:', error);
        return {
            success: false,
            message: error.message || '상태 변경 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 담당자 배정 (관리자 전용)
 */
export async function assignHandlerOrdering(
    url: string,
    requestNo: string,
    handlerEmail: string,
    sessionToken: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'assignHandler',
            {
                requestNo,
                handlerEmail,
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to assign handler:', error);
        return {
            success: false,
            message: error.message || '담당자 배정 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 신청자 비고 업데이트 (신청자 본인 또는 관리자만 가능)
 */
export async function updateRequesterRemarksOrdering(
    url: string,
    requestNo: string,
    requesterRemarks: string,
    sessionToken: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'updateRequesterRemarks',
            {
                requestNo,
                requesterRemarks,
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to update requester remarks:', error);
        return {
            success: false,
            message: error.message || '신청자 비고 업데이트 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 접수 담당자 비고 업데이트 (접수 담당자 또는 관리자만 가능)
 */
export async function updateHandlerRemarksOrdering(
    url: string,
    requestNo: string,
    handlerRemarks: string,
    sessionToken: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await postOrderingData<{ success: boolean; message?: string }>(
            url,
            'updateHandlerRemarks',
            {
                requestNo,
                handlerRemarks,
                token: sessionToken
            }
        );

        return result;
    } catch (error: any) {
        console.error('Failed to update handler remarks:', error);
        return {
            success: false,
            message: error.message || '접수 담당자 비고 업데이트 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 내 신청 목록을 엑셀 파일로 다운로드 (기간 필터 지원)
 */
export async function downloadMyRequestsExcel(
    url: string,
    sessionToken: string,
    dateFrom?: string,
    dateTo?: string,
    fileName?: string
): Promise<void> {
    try {
        // 기간 필터가 있으면 API 호출하여 데이터 가져오기
        let requests: Request[];
        if (dateFrom || dateTo) {
            const result = await getMyRequestsOrdering(
                url,
                { dateFrom, dateTo },
                sessionToken
            );
            // 페이징 결과인 경우 data 추출
            if (result && typeof result === 'object' && 'data' in result) {
                requests = (result as PaginatedResult<Request>).data;
            } else if (Array.isArray(result)) {
                requests = result;
            } else {
                requests = [];
            }
        } else {
            // 전체 다운로드인 경우 페이징 없이 모든 데이터 가져오기
            const result = await getMyRequestsOrdering(
                url,
                { page: 1, pageSize: 99999 }, // 충분히 큰 값으로 모든 데이터 가져오기
                sessionToken
            );
            // 페이징 결과인 경우 data 추출
            if (result && typeof result === 'object' && 'data' in result) {
                requests = (result as PaginatedResult<Request>).data;
            } else if (Array.isArray(result)) {
                requests = result;
            } else {
                requests = [];
            }
        }

        if (requests.length === 0) {
            throw new Error('다운로드할 데이터가 없습니다.');
        }

        // 파일명 생성
        let finalFileName = fileName;
        if (!finalFileName) {
            const today = new Date();
            const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
            if (dateFrom && dateTo) {
                const fromStr = dateFrom.replace(/-/g, '');
                const toStr = dateTo.replace(/-/g, '');
                finalFileName = `내신청목록_${fromStr}-${toStr}.xlsx`;
            } else {
                // 전체 다운로드
                finalFileName = `내신청목록_전체_${dateStr}.xlsx`;
            }
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('내 신청 목록');

        // 헤더 정의
        const headers = [
            '신청번호',
            '신청일시',
            '신청자이름',
            '기사코드',
            '소속팀',
            '지역',
            '품명',
            '모델명',
            '시리얼번호',
            '수량',
            '관리번호',
            '수령지',
            '전화번호',
            '업체명',
            '비고',
            '사진URL',
            '상태',
            '접수담당자',
            '담당자비고',
            '발주일시',
            '예상납기일시',
            '수령확인일시'
        ];

        // 헤더 스타일
        const headerStyle: Partial<ExcelJS.Style> = {
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF2F2F2' }
            },
            font: {
                bold: true,
                size: 11,
                name: 'Malgun Gothic'
            },
            alignment: {
                horizontal: 'center',
                vertical: 'middle'
            },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // 데이터 스타일
        const dataStyle: Partial<ExcelJS.Style> = {
            font: {
                size: 10,
                name: 'Malgun Gothic'
            },
            alignment: {
                vertical: 'middle'
            },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // 헤더 추가
        worksheet.addRow(headers);
        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.eachCell((cell) => {
            cell.style = headerStyle;
        });

        // 데이터 추가
        requests.forEach((req) => {
            const row = worksheet.addRow([
                req.requestNo || '',
                req.requestDate || '',
                req.requesterName || '',
                req.employeeCode || '',
                req.team || '',
                req.region || '',
                req.itemName || '',
                req.modelName || '',
                req.serialNo || '',
                req.quantity || 0,
                req.assetNo || '',
                req.deliveryPlace || '',
                req.phone || '',
                req.company || '',
                req.remarks || '',
                req.photoUrl || '',
                req.status || '',
                req.handler || '',
                req.handlerRemarks || '',
                req.orderDate || '',
                req.expectedDeliveryDate || '',
                req.receiptDate || ''
            ]);

            // 행 높이 자동 설정: 셀 내용에 따라 높이 계산
            let maxLines = 1;
            row.eachCell((cell, colNumber) => {
                if (cell.value) {
                    const cellValue = String(cell.value);
                    // 줄바꿈 문자 개수 + 1 (기본 1줄)
                    const lineCount = (cellValue.match(/\n/g) || []).length + 1;
                    // 셀 너비를 고려한 줄 수 계산 (대략적인 계산)
                    // 컬럼 인덱스는 1부터 시작하므로 colNumber - 1 사용
                    const column = worksheet.getColumn(colNumber);
                    const cellWidth = column.width || 10;
                    const estimatedLines = Math.ceil(cellValue.length / (cellWidth * 0.8));
                    const totalLines = Math.max(lineCount, estimatedLines);
                    if (totalLines > maxLines) {
                        maxLines = totalLines;
                    }
                }
            });
            // 최소 높이 20, 최대 높이 100, 줄당 약 15px
            row.height = Math.min(Math.max(maxLines * 15, 20), 100);

            row.eachCell((cell) => {
                cell.style = dataStyle;
                // 텍스트 줄바꿈 활성화
                cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'top' };
            });
        });

        // 컬럼 너비 자동 조정
        worksheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(Math.max(maxLength + 2, 10), 50);
        });

        // 파일 다운로드
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = finalFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('Failed to download Excel:', error);
        throw new Error('엑셀 다운로드 중 오류가 발생했습니다.');
    }
}

