/**
 * 날짜 포맷팅
 */
export function formatDate(
  input: string | number | Date | null | undefined
): string {
  if (input === null || input === undefined) return '';

  const raw = typeof input === 'string' ? input.trim() : input;
  if (raw === '') return '';

  const pad2 = (n: number) => String(n).padStart(2, '0');

  /**
   * Date(UTC epoch)를 KST(+9) 기준으로 표시용 파츠로 변환
   * - 기기/브라우저 타임존과 무관하게 항상 KST로 출력
   */
  const toKstParts = (date: Date) => {
    const kstMs = date.getTime() + 9 * 60 * 60 * 1000;
    const kst = new Date(kstMs);
    return {
      yyyy: kst.getUTCFullYear(),
      mm: pad2(kst.getUTCMonth() + 1),
      dd: pad2(kst.getUTCDate()),
      hh: pad2(kst.getUTCHours()),
      mi: pad2(kst.getUTCMinutes()),
      ss: pad2(kst.getUTCSeconds()),
    };
  };

  const inputHasTime = (v: typeof input): boolean => {
    if (v instanceof Date) {
      return v.getHours() !== 0 || v.getMinutes() !== 0 || v.getSeconds() !== 0;
    }
    if (typeof v === 'number') {
      // epoch(ms)로 들어온 값은 시간 정보를 포함한다고 보고 time 출력
      return true;
    }
    if (typeof v === 'string') {
      const s = v.trim();
      // 10:30 / 10:30:45 / 오전 9:45:44 등
      return /(\d{1,2}:\d{2})(:\d{2})?/.test(s) || /(오전|오후)/.test(s);
    }
    return false;
  };

  const parseToDate = (v: typeof input): Date | null => {
    if (v instanceof Date) return v;
    if (typeof v === 'number') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v !== 'string') return null;

    const s = v.trim();
    if (!s) return null;

    // "YYYY-MM-DD"는 KST 날짜(일)로 취급 (기기 타임존 영향 제거)
    const mYmdDash = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mYmdDash) {
      const y = Number(mYmdDash[1]);
      const mo = Number(mYmdDash[2]);
      const d = Number(mYmdDash[3]);
      // KST 00:00:00 -> UTC로는 전날 15:00:00
      const utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
      return new Date(utcMs);
    }

    // "YYYY.MM.DD" 또는 "YYYY. M. D" + (오전/오후) + HH:mm(:ss)
    const mKo = s.match(
      /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})(?:\s+(오전|오후)\s+(\d{1,2})(?::(\d{2}))(?::(\d{2}))?)?$/
    );
    if (mKo) {
      const y = Number(mKo[1]);
      const mo = Number(mKo[2]);
      const d = Number(mKo[3]);
      let hh = mKo[5] ? Number(mKo[5]) : 0;
      const mm = mKo[6] ? Number(mKo[6]) : 0;
      const ss = mKo[7] ? Number(mKo[7]) : 0;
      const ampm = mKo[4];
      if (ampm) {
        // 오전/오후 12시 처리 포함
        if (ampm === '오후' && hh < 12) hh += 12;
        if (ampm === '오전' && hh === 12) hh = 0;
      }
      // KST 기준으로 고정 생성
      const utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss) - 9 * 60 * 60 * 1000;
      return new Date(utcMs);
    }

    // "YYYY.MM.DD" / "YYYY/M/D" / "YYYY-M-D" 계열(시간 없음)
    const mYmdAny = s.match(/^(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})$/);
    if (mYmdAny) {
      const y = Number(mYmdAny[1]);
      const mo = Number(mYmdAny[2]);
      const d = Number(mYmdAny[3]);
      const utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
      return new Date(utcMs);
    }

    // 마지막 fallback: Date 파서
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const hasTime = inputHasTime(input);
  const date = parseToDate(input);
  if (!date) return String(input);

  const parts = toKstParts(date);
  const base = `${parts.yyyy}.${parts.mm}.${parts.dd}`;

  if (!hasTime) return base;

  return `${base} ${parts.hh}:${parts.mi}:${parts.ss}`;
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
  // 기기/브라우저 타임존과 무관하게 KST(Asia/Seoul) 기준으로 날짜 범위를 계산
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const kstNow = new Date(utcMs + 9 * 60 * 60 * 1000);
  // KST 프레임에서의 "오늘 끝" (UTC getter/setter 사용)
  const today = new Date(kstNow.getTime());
  today.setUTCHours(23, 59, 59, 999);

  let dateFrom: Date;
  const dateTo = new Date(today.getTime());

  switch (period) {
    case 'today':
      dateFrom = new Date(today.getTime());
      dateFrom.setUTCHours(0, 0, 0, 0);
      break;

    case 'thisWeek':
      dateFrom = new Date(today.getTime());
      const dayOfWeek = today.getUTCDay(); // 0: 일요일, 6: 토요일 (KST 프레임)
      dateFrom.setUTCDate(today.getUTCDate() - dayOfWeek);
      dateFrom.setUTCHours(0, 0, 0, 0);
      break;

    case 'thisMonth':
      dateFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0, 0));
      break;

    case 'last3Months':
      dateFrom = new Date(today.getTime());
      dateFrom.setUTCMonth(today.getUTCMonth() - 3);
      dateFrom.setUTCDate(1);
      dateFrom.setUTCHours(0, 0, 0, 0);
      break;

    default:
      dateFrom = new Date(today.getTime());
      dateFrom.setUTCHours(0, 0, 0, 0);
  }

  // YYYY-MM-DD 형식으로 변환
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
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

