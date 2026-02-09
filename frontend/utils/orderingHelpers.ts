/**
 * 날짜 포맷팅
 */
export function formatDate(
  dateString: string | null | undefined,
  format: 'full' | 'short' | 'date' = 'full'
): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    if (format === 'date') {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }
    
    if (format === 'short') {
      return date.toLocaleDateString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
      });
    }
    
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return String(dateString);
  }
}

/**
 * 상태별 색상 반환 (Tailwind CSS 클래스)
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    '접수중': 'bg-red-100 text-red-800',
    '접수완료': 'bg-yellow-100 text-yellow-800',
    '발주완료(납기확인)': 'bg-blue-100 text-blue-800',
    '발주완료(납기미정)': 'bg-cyan-100 text-cyan-800',
    '처리완료': 'bg-green-100 text-green-800',
    '접수취소': 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * 기간 선택에 따른 날짜 범위 계산
 * @param period - 'today' | 'thisWeek' | 'thisMonth' | 'last3Months'
 * @returns { dateFrom: string, dateTo: string } - YYYY-MM-DD 형식
 */
export function getDateRange(period: 'today' | 'thisWeek' | 'thisMonth' | 'last3Months'): {
  dateFrom: string;
  dateTo: string;
} {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // 오늘 끝 시간

  let dateFrom: Date;
  const dateTo = new Date(today);

  switch (period) {
    case 'today':
      dateFrom = new Date(today);
      dateFrom.setHours(0, 0, 0, 0);
      break;

    case 'thisWeek':
      dateFrom = new Date(today);
      const dayOfWeek = today.getDay(); // 0: 일요일, 6: 토요일
      dateFrom.setDate(today.getDate() - dayOfWeek); // 이번 주 월요일
      dateFrom.setHours(0, 0, 0, 0);
      break;

    case 'thisMonth':
      dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
      dateFrom.setHours(0, 0, 0, 0);
      break;

    case 'last3Months':
      dateFrom = new Date(today);
      dateFrom.setMonth(today.getMonth() - 3);
      dateFrom.setDate(1); // 3개월 전 1일
      dateFrom.setHours(0, 0, 0, 0);
      break;

    default:
      dateFrom = new Date(today);
      dateFrom.setHours(0, 0, 0, 0);
  }

  // YYYY-MM-DD 형식으로 변환
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    dateFrom: formatDate(dateFrom),
    dateTo: formatDate(dateTo),
  };
}

/**
 * Google Drive URL을 이미지 프록시 URL로 변환
 * @param url - 원본 URL (Google Drive 링크 또는 data URL)
 * @returns 변환된 이미지 URL
 */
export function getImageUrl(url: string): string {
  if (!url) return '';

  // 이미 data URL인 경우 그대로 반환
  if (url.startsWith('data:')) {
    return url;
  }

  // Google Drive 파일 링크인 경우 변환
  if (url.includes('drive.google.com')) {
    let fileId = '';
    // 형식 1: /file/d/{FILE_ID}
    const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) {
      fileId = match1[1];
    } else {
      // 형식 2: ?id={FILE_ID}
      const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match2 && match2[1]) {
        fileId = match2[1];
      }
    }
    
    if (fileId) {
      // Google의 이미지 프록시 서버 사용 (가장 안정적)
      // w0-h0은 원본 크기, 필요시 크기 제한 가능 (예: w800-h600)
      return `https://lh3.googleusercontent.com/d/${fileId}=w0-h0`;
    }
  }
  
  // 다른 URL인 경우 그대로 반환
  return url;
}

/**
 * 이미지를 프리로딩 (백그라운드에서 미리 로드)
 * @param url - 프리로딩할 이미지 URL
 * @returns Promise<void> - 로딩 완료 시 resolve
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!url) {
      resolve();
      return;
    }

    // URL 변환 (Google Drive 링크인 경우)
    const imageUrl = getImageUrl(url);

    // 이미 data URL이거나 변환된 URL인 경우
    const img = new Image();
    
    img.onload = () => {
      resolve();
    };
    
    img.onerror = () => {
      // 프리로딩 실패해도 에러를 throw하지 않음 (상세 페이지는 정상 진입 가능)
      resolve();
    };
    
    // 크로스 오리진 이미지 로딩 허용
    img.crossOrigin = 'anonymous';
    
    // 이미지 로드 시작
    img.src = imageUrl;
  });
}

