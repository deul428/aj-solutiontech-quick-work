import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import Pagination from './Pagination';

export interface TableColumn<T = any> {
  key: string;
  label: React.ReactNode;
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
  /**
   * 기본 td/th max-width를 강제로 지정합니다.
   * - 컬럼에서 w-/min-w-/max-w- 등을 명시한 경우에는 적용되지 않습니다.
   * - 예: "150px", "12rem"
   */
  tdMaxW?: string;
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
  getRowClassName,
  tdMaxW
}: DataTableProps<T>) => {
  // 테이블 컬럼 폭 제어:
  // - table-layout:auto(기본)에서는 콘텐츠가 폭을 밀어 max-w가 잘 안 먹습니다.
  // - table-fixed + (w/max-w) + 셀 내부 truncate 래퍼 조합이 가장 안정적입니다.
  const DEFAULT_CELL_MAX_W = 'sm:max-w-[150px] ';

  const hasExplicitSizing = (className?: string) => {
    if (!className) return false;
    // w-/min-w-/max-w- 또는 임의값(w-[...]) 계열이 있으면 기본 폭 규칙을 적용하지 않음
    // (예: 체크박스 컬럼은 w-12 같이 별도 폭을 주는 경우가 많음)
    return /(^|\s)(!?((xs|sm|md|lg|xl|2xl):)*)?(w-|min-w-|max-w-|w\[|min-w\[|max-w\[)/.test(className);
  };

  const getCellMaxWClass = (column: TableColumn<T>) => {
    const explicit = hasExplicitSizing(column.headerClassName) || hasExplicitSizing(column.className);
    // tdMaxW가 주어지면 Tailwind max-w 대신 인라인 스타일로 제어
    return explicit ? '' : (tdMaxW ? '' : DEFAULT_CELL_MAX_W);
  };

  const getCellMaxWStyle = (column: TableColumn<T>): React.CSSProperties | undefined => {
    const explicit = hasExplicitSizing(column.headerClassName) || hasExplicitSizing(column.className);
    if (explicit) return undefined;
    if (!tdMaxW) return undefined;
    return { maxWidth: tdMaxW };
  };

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
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column)}
                    className={`${getCellMaxWClass(column)} px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      } ${column.headerClassName || ''}`}
                    style={getCellMaxWStyle(column)}
                  >
                    {(() => {
                      const label = column.label;
                      const isLabelPrimitive = typeof label === 'string' || typeof label === 'number';
                      const wantsCenter = (column.headerClassName || '').includes('text-center');

                      if (column.sortable) {
                        return (
                          <div className={`flex items-center gap-2 min-w-0 ${wantsCenter ? 'justify-center' : ''}`}>
                            {isLabelPrimitive ? <span className={`${tdMaxW && tdMaxW === 'auto' ? '' : 'truncate'}`}>{label}</span> : label}
                            {getSortIcon(column)}
                          </div>
                        );
                      }

                      // sortable 아닌 경우: label이 JSX(체크박스 등)면 truncate 래핑하지 않음
                      return (
                        <div className={`${wantsCenter ? 'flex justify-center' : ''}`}>
                          {isLabelPrimitive ? <span className={`${tdMaxW && tdMaxW === 'auto' ? '' : 'truncate'}`}>{label}</span> : label}
                        </div>
                      );
                    })()}
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
                        const isPrimitiveCell =
                          typeof cellContent === 'string' ||
                          typeof cellContent === 'number';
                        const tdCenterFromHeader =
                          (column.headerClassName || '').includes('text-center') &&
                          !(column.className || '').includes('text-center');
                        return (
                          <td
                            key={column.key}
                            className={`${getCellMaxWClass(column)} px-3 py-2 text-sm text-gray-900 ${tdCenterFromHeader ? 'text-center' : ''} ${column.className || ''}`}
                            style={getCellMaxWStyle(column)}
                          >
                            {isPrimitiveCell ? (
                              <div className={`min-w-0 ${tdMaxW && tdMaxW === 'auto' ? '' : 'truncate'}`} title={String(cellContent)}>
                                {cellContent}
                              </div>
                            ) : (
                              cellContent
                            )}
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
      {
        showPagination && onPageChange && data.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={data.length}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            pageSizeOptions={pageSizeOptions}
          />
        )
      }
    </div >
  );
};

export default DataTable;

