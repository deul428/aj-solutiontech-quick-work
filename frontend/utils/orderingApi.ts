// Google Apps Script API 호출 유틸리티

declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler: (callback: (result: any) => void) => {
            withFailureHandler: (callback: (error: any) => void) => {
              [key: string]: (...args: any[]) => void;
            };
          };
        };
      };
    };
  }
}

/**
 * Google Apps Script 함수를 비동기로 호출하는 래퍼 함수
 */
export function callServer<T = any>(
  functionName: string,
  ...args: any[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!window.google?.script?.run) {
      // Google Apps Script가 없는 경우 빈 데이터 반환 (개발 환경)
      console.warn('Google Apps Script API가 로드되지 않았습니다. 모의 데이터를 반환합니다.');
      resolve({} as T);
      return;
    }

    window.google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      [functionName](...args);
  });
}

/**
 * 웹 앱 URL 가져오기
 */
export async function getWebAppUrl(): Promise<string> {
  try {
    const url = await callServer<string>('getWebAppUrl');
    return url || '';
  } catch (error) {
    console.error('Failed to get web app URL:', error);
    return '';
  }
}

