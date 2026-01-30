/**
 * 관리자 서비스 함수
 * 관리자 전용 기능을 위한 API 호출 함수들
 */

import { ORDERING_GAS_URL } from './orderingService';
import { DEFAULT_GAS_URL } from './excelService';
import { getSessionToken } from '../utils/orderingAuth';
import { User, DeliveryPlace } from '../types/ordering';
import ExcelJS from 'exceljs';

/**
 * 체크리스트 데이터 조회 (관리자 전용)
 * 체크리스트 시스템(DEFAULT_GAS_URL)의 체크리스트_데이터 시트를 조회합니다.
 * @param filter - 필터 옵션 {search?, sortBy?, sortOrder?, page?, pageSize?}
 * @param sessionToken - 세션 토큰 (현재는 사용하지 않지만 호환성을 위해 유지)
 * @returns 체크리스트 데이터 배열 또는 페이징 객체
 */
export async function getChecklistData(
  filter: {
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  } = {},
  sessionToken?: string
): Promise<any[] | { data: any[]; total: number; page: number; pageSize: number; totalPages: number }> {
  try {
    if (!DEFAULT_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const params = new URLSearchParams();
    params.append('action', 'getChecklistData');
    if (filter.search) params.append('search', filter.search);
    if (filter.sortBy) params.append('sortBy', filter.sortBy);
    if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);
    if (filter.page) params.append('page', String(filter.page));
    if (filter.pageSize) params.append('pageSize', String(filter.pageSize));
    params.append('t', String(Date.now()));

    const response = await fetch(`${DEFAULT_GAS_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('getChecklistData error:', error);
    throw new Error(error.message || '체크리스트 데이터 조회 실패');
  }
}

/**
 * 체크리스트 데이터 전체 조회 (관리자 전용)
 * 서버 페이징 응답일 때도 모든 페이지를 순회해서 전체 데이터를 반환합니다.
 */
export async function getAllChecklistData(
  filter: {
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    pageSize?: number;
  } = {}
): Promise<any[]> {
  const pageSize = filter.pageSize || 500;

  const first = await getChecklistData({
    search: filter.search,
    sortBy: filter.sortBy,
    sortOrder: filter.sortOrder,
    page: 1,
    pageSize
  });

  if (Array.isArray(first)) {
    return first;
  }

  const all: any[] = [...(first.data || [])];
  const totalPages = first.totalPages || 1;

  for (let page = 2; page <= totalPages; page++) {
    const res = await getChecklistData({
      search: filter.search,
      sortBy: filter.sortBy,
      sortOrder: filter.sortOrder,
      page,
      pageSize
    });
    if (Array.isArray(res)) {
      // 하위 호환: 배열로 내려오는 경우엔 여기서 종료
      return res;
    }
    all.push(...(res.data || []));
  }

  return all;
}

/**
 * 체크리스트 내역 엑셀 다운로드
 * @param checklistData - 체크리스트 데이터 배열
 * @param fileName - 파일명 (기본값: '자산실사내역.xlsx')
 */
export async function downloadChecklistHistoryExcel(
  checklistData: any[],
  fileName: string = '자산실사내역.xlsx'
): Promise<void> {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('자산 실사 내역');

    if (checklistData.length === 0) {
      throw new Error('다운로드할 데이터가 없습니다.');
    }

    // 헤더는 데이터의 첫 번째 객체의 키를 사용
    const headers = Object.keys(checklistData[0]);
    
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

    // QR 컬럼 인덱스 찾기
    const qrColumnIndex = headers.findIndex(header => header === 'QR');
    const qrColumnNumber = qrColumnIndex >= 0 ? qrColumnIndex + 1 : -1;

    // 데이터 추가
    for (let i = 0; i < checklistData.length; i++) {
      const item = checklistData[i];
      const row = worksheet.addRow(
        headers.map(header => {
          // QR 컬럼은 빈 문자열로 설정 (이미지로 대체할 예정)
          if (header === 'QR') {
            return '';
          }
          return item[header] || '';
        })
      );

      const rowNumber = i + 2; // 헤더 행 다음부터

      // QR 이미지 처리
      if (qrColumnNumber > 0 && item['QR']) {
        const qrValue = item['QR'];
        if (typeof qrValue === 'string' && qrValue.startsWith('http')) {
          try {
            // URL에서 이미지 다운로드
            const response = await fetch(qrValue);
            if (response.ok) {
              const blob = await response.blob();
              
              // Blob을 base64로 변환
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                  const base64String = reader.result as string;
                  resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              
              const base64String = await base64Promise;
              
              // base64에서 데이터 부분만 추출 (data:image/png;base64, 제거)
              const base64Data = base64String.split(',')[1] || base64String;
              
              const imageId = workbook.addImage({
                base64: base64Data,
                extension: 'png'
              });
              
              // QR 컬럼에 이미지 삽입
              const imageWidth = 80;
              const imageHeight = 80;
              worksheet.addImage(imageId, {
                tl: { col: qrColumnIndex + 0.1, row: rowNumber - 0.9 },
                ext: { width: imageWidth, height: imageHeight }
              });

              // QR 컬럼 너비 설정
              const qrColumn = worksheet.getColumn(qrColumnNumber);
              if (!qrColumn.width || qrColumn.width < 12) {
                qrColumn.width = 12;
              }

              // 행 높이를 이미지 높이에 맞게 조정
              const currentRow = worksheet.getRow(rowNumber);
              if (!currentRow.height || currentRow.height < imageHeight) {
                currentRow.height = imageHeight;
              }
            }
          } catch (error) {
            console.error('Failed to load QR image:', error);
            // 이미지 로드 실패 시 빈 셀 유지
          }
        }
      }

      // 행 높이 자동 설정 (QR이 아닌 다른 컬럼 기준)
      let maxLines = 1;
      row.eachCell((cell, colNumber) => {
        if (colNumber !== qrColumnNumber && cell.value) {
          const cellValue = String(cell.value);
          const lineCount = (cellValue.match(/\n/g) || []).length + 1;
          const column = worksheet.getColumn(colNumber);
          const cellWidth = column.width || 10;
          const estimatedLines = Math.ceil(cellValue.length / (cellWidth * 0.8));
          const totalLines = Math.max(lineCount, estimatedLines);
          if (totalLines > maxLines) {
            maxLines = totalLines;
          }
        }
      });
      
      // QR 이미지가 없는 경우에만 텍스트 기반 높이 설정
      if (qrColumnNumber <= 0 || !item['QR'] || !(typeof item['QR'] === 'string' && item['QR'].startsWith('http'))) {
        row.height = Math.min(Math.max(maxLines * 15, 20), 100);
      }

      row.eachCell((cell, colNumber) => {
        // QR 컬럼은 스타일 적용하지 않음 (이미지가 있으므로)
        if (colNumber !== qrColumnNumber) {
          cell.style = dataStyle;
          cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'top' };
        } else {
          // QR 컬럼은 중앙 정렬
          cell.alignment = { ...cell.alignment, vertical: 'middle', horizontal: 'center' };
        }
      });
    }

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
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error: any) {
    console.error('Failed to download Excel:', error);
    throw new Error(`엑셀 다운로드 중 오류가 발생했습니다: ${error.message || error}`);
  }
}

/**
 * 전체 사용자 조회 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '사용자관리' 시트 데이터 조회
 * @param sessionToken - 세션 토큰
 * @returns 사용자 목록 배열
 */
export async function getAllUsers(sessionToken?: string): Promise<User[]> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const params = new URLSearchParams();
    params.append('action', 'getAllUsers');
    params.append('token', token);
    params.append('t', String(Date.now()));

    const response = await fetch(`${ORDERING_GAS_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('getAllUsers error:', error);
    throw new Error(error.message || '사용자 목록 조회 실패');
  }
}

/**
 * 사용자 등록 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '사용자관리' 시트에 데이터 등록
 * @param userData - 사용자 데이터 {userId, password, name, employeeCode, team, region, role, active}
 * @param sessionToken - 세션 토큰
 * @returns 결과 객체
 */
export async function createUser(
  userData: {
    userId: string;
    password?: string;
    name: string;
    employeeCode?: string;
    team: string;
    region: string;
    role: '신청자' | '관리자';
    active?: string;
  },
  sessionToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const payload = {
      token: token,
      userData: userData
    };

    const response = await fetch(ORDERING_GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'createUser',
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('createUser error:', error);
    throw new Error(error.message || '사용자 등록 실패');
  }
}

/**
 * 사용자 수정 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '사용자관리' 시트 데이터 수정
 * @param userId - 사용자 ID
 * @param userData - 수정할 사용자 데이터
 * @param sessionToken - 세션 토큰
 * @returns 결과 객체
 */
export async function updateUser(
  userId: string,
  userData: {
    name?: string;
    employeeCode?: string;
    team?: string;
    region?: string;
    role?: '신청자' | '관리자';
    active?: string;
    password?: string;
  },
  sessionToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const payload = {
      token: token,
      userId: userId,
      userData: userData
    };

    const response = await fetch(ORDERING_GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'updateUser',
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('updateUser error:', error);
    throw new Error(error.message || '사용자 수정 실패');
  }
}

/**
 * 사용자 삭제 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '사용자관리' 시트 데이터 삭제
 * @param userId - 사용자 ID
 * @param sessionToken - 세션 토큰
 * @returns 결과 객체
 */
export async function deleteUser(
  userId: string,
  sessionToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const payload = {
      token: token,
      userId: userId
    };

    const response = await fetch(ORDERING_GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'deleteUser',
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('deleteUser error:', error);
    throw new Error(error.message || '사용자 삭제 실패');
  }
}

/**
 * 전체 배송지 조회 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '배송지관리' 시트 데이터 조회
 * @param sessionToken - 세션 토큰
 * @returns 배송지 목록 배열
 */
export async function getAllDeliveryPlaces(sessionToken?: string): Promise<DeliveryPlace[]> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const params = new URLSearchParams();
    params.append('action', 'getAllDeliveryPlaces');
    params.append('token', token);
    params.append('t', String(Date.now()));

    const response = await fetch(`${ORDERING_GAS_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('getAllDeliveryPlaces error:', error);
    throw new Error(error.message || '배송지 목록 조회 실패');
  }
}

/**
 * 배송지 등록 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '배송지관리' 시트에 데이터 등록
 * @param placeData - 배송지 데이터 {배송지명, 소속팀, 주소, 연락처, 담당자, 활성화, 비고}
 * @param sessionToken - 세션 토큰
 * @returns 결과 객체
 */
export async function createDeliveryPlace(
  placeData: {
    '배송지명': string;
    '소속팀'?: string;
    '주소'?: string;
    '연락처'?: string;
    '담당자'?: string;
    '활성화'?: string;
    '비고'?: string;
  },
  sessionToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const payload = {
      token: token,
      placeData: placeData
    };

    const response = await fetch(ORDERING_GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'createDeliveryPlace',
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('createDeliveryPlace error:', error);
    throw new Error(error.message || '배송지 등록 실패');
  }
}

/**
 * 배송지 수정 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '배송지관리' 시트 데이터 수정
 * @param placeName - 배송지명 (기존)
 * @param placeData - 수정할 배송지 데이터
 * @param sessionToken - 세션 토큰
 * @returns 결과 객체
 */
export async function updateDeliveryPlace(
  placeName: string,
  placeData: {
    '배송지명'?: string;
    '소속팀'?: string;
    '주소'?: string;
    '연락처'?: string;
    '담당자'?: string;
    '활성화'?: string;
    '비고'?: string;
  },
  sessionToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const payload = {
      token: token,
      placeName: placeName,
      placeData: placeData
    };

    const response = await fetch(ORDERING_GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'updateDeliveryPlace',
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('updateDeliveryPlace error:', error);
    throw new Error(error.message || '배송지 수정 실패');
  }
}

/**
 * 배송지 삭제 (관리자 전용)
 * ordering_gas_url과 연결된 구글 시트 내 '배송지관리' 시트 데이터 삭제
 * @param placeName - 배송지명
 * @param sessionToken - 세션 토큰
 * @returns 결과 객체
 */
export async function deleteDeliveryPlace(
  placeName: string,
  sessionToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = sessionToken || getSessionToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    if (!ORDERING_GAS_URL) {
      throw new Error('GAS URL이 설정되지 않았습니다.');
    }

    const payload = {
      token: token,
      placeName: placeName
    };

    const response = await fetch(ORDERING_GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'deleteDeliveryPlace',
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('deleteDeliveryPlace error:', error);
    throw new Error(error.message || '배송지 삭제 실패');
  }
}

