import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 30, 50],
  disabled
}) => {
  // totalPages가 1 이하일 때도 페이지 크기 변경이 필요하므로 항상 렌더링
  // 단, 페이지 번호와 네비게이션 버튼은 totalPages > 1일 때만 표시

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      for (let p = 1; p <= totalPages; p++) pages.push(p);
      return pages;
    }

    if (currentPage <= 3) {
      for (let p = 1; p <= 5; p++) pages.push(p);
      return pages;
    }

    if (currentPage >= totalPages - 2) {
      for (let p = totalPages - 4; p <= totalPages; p++) pages.push(p);
      return pages;
    }

    for (let p = currentPage - 2; p <= currentPage + 2; p++) pages.push(p);
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const startIndex = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = total > 0 ? Math.min(currentPage * pageSize, total) : 0;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t border-gray-200">
      <div className="text-sm font-bold text-gray-600">
        {total > 0 ? `${startIndex} - ${endIndex} / ${total}건` : '0건'}
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}개씩
              </option>
            ))}
          </select>
        )}

        {/* 페이지 번호와 네비게이션 버튼은 totalPages > 1일 때만 표시 */}
        {totalPages > 1 && (
          <>
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={disabled || currentPage === 1}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  disabled={disabled}
                  className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${
                    currentPage === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={disabled || currentPage === totalPages}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Pagination;


