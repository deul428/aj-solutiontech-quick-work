import React, { useEffect, useState } from 'react';
import { getDateRange } from '../utils/orderingHelpers';
import Button from './Button';

export type ExcelDateRangeResult =
  | { all: true }
  | { all: false; dateFrom: string; dateTo: string };

interface ExcelDateRangeModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onConfirm: (result: ExcelDateRangeResult) => void | Promise<void>;
  isDownloading?: boolean;
}

const ExcelDateRangeModal: React.FC<ExcelDateRangeModalProps> = ({
  isOpen,
  title = '엑셀 다운로드 기간 선택',
  onClose,
  onConfirm,
  isDownloading = false
}) => {
  const [excelDateFrom, setExcelDateFrom] = useState<string>('');
  const [excelDateTo, setExcelDateTo] = useState<string>('');
  const [excelDateRangeAll, setExcelDateRangeAll] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // 모달 오픈 시 기본값 초기화 (기존 페이지 로직과 동일하게 빈 값)
    setExcelDateFrom('');
    setExcelDateTo('');
    setExcelDateRangeAll(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickExcelDateFilter = (period: 'today' | 'thisWeek' | 'thisMonth' | 'last3Months' | 'all') => {
    if (period === 'all') {
      setExcelDateFrom('');
      setExcelDateTo('');
      setExcelDateRangeAll(true);
      return;
    }
    const range = getDateRange(period);
    setExcelDateFrom(range.dateFrom);
    setExcelDateTo(range.dateTo);
    setExcelDateRangeAll(false);
  };

  const isConfirmDisabled = !excelDateRangeAll && (!excelDateFrom || !excelDateTo);

  return (
    <div className="fixed inset-0 bg-black  bounding-box bg-opacity-50 flex items-center justify-center z-50 p-4 ">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xl w-full">
        <h3 className="text-xl font-black text-gray-800 mb-4">{title}</h3>

        <div className="space-y-4">
          {/* 퀵 버튼 */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">빠른 선택</label>
            <div className="flex flex-wrap gap-2">
              <Button variant={`${excelDateFrom && excelDateFrom === getDateRange('today').dateFrom ? 'primary' : 'gray'}`} onClick={() => handleQuickExcelDateFilter('today')}>
                오늘
              </Button>
              <Button variant={`${excelDateFrom && excelDateFrom === getDateRange('thisWeek').dateFrom ? 'primary' : 'gray'}`} onClick={() => handleQuickExcelDateFilter('thisWeek')}>
                이번 주
              </Button>
              <Button variant={`${excelDateFrom && excelDateFrom === getDateRange('thisMonth').dateFrom ? 'primary' : 'gray'}`} onClick={() => handleQuickExcelDateFilter('thisMonth')}>
                이번 달
              </Button>
              <Button variant={`${excelDateFrom && excelDateFrom === getDateRange('last3Months').dateFrom ? 'primary' : 'gray'}`} onClick={() => handleQuickExcelDateFilter('last3Months')}>
                최근 3개월
              </Button>
              <Button variant={`${excelDateRangeAll ? 'primary' : 'gray'}`} onClick={() => handleQuickExcelDateFilter('all')}>
                전체
              </Button>
            </div>
          </div>

          {/* 전체 선택 시 경고 문구 */}
          {excelDateRangeAll && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
              <p className="text-yellow-800 text-sm font-semibold">
                ⚠️ 전체 다운로드 시 데이터가 많을 경우 다운로드가 느려질 수 있습니다.
              </p>
            </div>
          )}

          {/* 커스텀 기간 선택 */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">기간 직접 선택</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={excelDateFrom}
                onChange={(e) => setExcelDateFrom(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={excelDateRangeAll}
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={excelDateTo}
                onChange={(e) => setExcelDateTo(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={excelDateRangeAll}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="gray" onClick={onClose}>
            취소
          </Button>
          <Button variant="success" onClick={() => {
            if (excelDateRangeAll) {
              onConfirm({ all: true });
            } else {
              onConfirm({ all: false, dateFrom: excelDateFrom, dateTo: excelDateTo });
            }
          }}
            disabled={isConfirmDisabled || isDownloading}
          >
            {isDownloading ? '다운로드 중...' : '다운로드'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExcelDateRangeModal;


