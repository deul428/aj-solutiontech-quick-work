import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import Pagination from './Pagination';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: string; // 정렬에 사용할 키 (key와 다를 경우)
  hidden?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  sortBy?: string | null;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  keyExtractor?: (row: T, index: number) => string | number;
  emptyMessage?: string;
  className?: string;
  showPagination?: boolean;
  getRowClassName?: (row: T, index: number) => string;
}

const DataTable = <T extends Record<string, any>>({
  data,
  columns,
  sortBy,
  sortOrder = 'asc',
  onSort,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 30, 50],
  keyExtractor,
  emptyMessage = '데이터가 없습니다.',
  className = '',
  showPagination = true,
  getRowClassName
}: DataTableProps<T>) => {
  // visible columns만 필터링
  const visibleColumns = useMemo(() => {
    return columns.filter(col => !col.hidden);
  }, [columns]);

  // 정렬 아이콘 표시
  const getSortIcon = (column: TableColumn<T>) => {
    if (!column.sortable) return null;
    const sortKey = column.sortKey || column.key;
    if (sortBy !== sortKey) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  // 페이지네이션된 데이터
  const paginatedData = useMemo(() => {
    if (!showPagination || !onPageChange) {
      return data;
    }
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize, showPagination, onPageChange]);

  const totalPages = useMemo(() => {
    if (!showPagination) return 1;
    return Math.ceil(data.length / pageSize);
  }, [data.length, pageSize, showPagination]);

  // 정렬 핸들러
  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable || !onSort) return;
    const sortKey = column.sortKey || column.key;
    onSort(sortKey);
  };

  return (
    <div className={className}>
      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column)}
                    className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      } ${column.headerClassName || ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {getSortIcon(column)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-3 py-8 text-center text-sm text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => {
                  const key = keyExtractor
                    ? keyExtractor(row, index)
                    : (row.id || row.key || index);
                  const rowClassName = getRowClassName ? getRowClassName(row, index) : '';
                  return (
                    <tr key={key} className={`hover:bg-gray-50 ${rowClassName}`}>
                      {visibleColumns.map((column) => {
                        const value = row[column.key];
                        const cellContent = column.render
                          ? column.render(value, row, index)
                          : (value ?? '-');
                        return (
                          <td
                            key={column.key}
                            className={`px-3 py-2 whitespace-nowrap text-sm text-gray-900 ${column.className || ''}`}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {showPagination && onPageChange && data.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          total={data.length}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
};

export default DataTable;

