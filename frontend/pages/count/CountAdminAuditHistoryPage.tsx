import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, RefreshCw, X } from 'lucide-react';
import { isAdmin, getCurrentUser } from '../../utils/orderingAuth';
import { getChecklistData, getAllChecklistData, downloadChecklistHistoryExcel } from '../../services/adminService';
import LoadingOverlay from '../../components/LoadingOverlay';
import ExcelDateRangeModal, { ExcelDateRangeResult } from '../../components/ExcelDateRangeModal';
import DataTable, { TableColumn } from '../../components/DataTable';

interface ChecklistDataItem {
  [key: string]: any;
  _rowIndex?: number;
}

// 테이블 컬럼 설정 - 여기서 쉽게 헤더 관리 가능
// hidden: true로 설정하면 컬럼 숨김
// sortable: true로 설정하면 정렬 가능
const getColumns = (onImageClick: (url: string) => void): TableColumn<ChecklistDataItem>[] => {
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if (value instanceof Date || (value.constructor && value.constructor.name === 'Date')) {
        return new Date(value).toLocaleString('ko-KR');
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  return [
    {
      key: '관리번호',
      label: '관리번호',
      sortable: true,
      sortKey: '관리번호'
    },
    {
      key: '자산번호',
      label: '자산번호',
      sortable: true,
      sortKey: '자산번호'
    },
    {
      key: '상품코드',
      label: '상품코드',
      sortable: false
    },
    {
      key: '상품명',
      label: '상품명',
      sortable: true,
      sortKey: '상품명'
    },
    {
      key: '제조사',
      label: '제조사',
      sortable: true,
      sortKey: '제조사'
    },
    {
      key: '모델',
      label: '모델',
      sortable: false
    },
    {
      key: '년식',
      label: '년식',
      sortable: false
    },
    {
      key: '차량번호',
      label: '차량번호',
      sortable: false
    },
    {
      key: '차대번호',
      label: '차대번호',
      sortable: false
    },
    {
      key: '자산실사일',
      label: '자산실사일',
      sortable: true,
      sortKey: '자산실사일',
      render: (value) => formatCellValue(value)
    },
    {
      key: '자산실사 여부',
      label: '자산실사 여부',
      sortable: false,
      render: (value) => formatCellValue(value)
    },
    {
      key: 'QR',
      label: 'QR',
      sortable: false,
      render: (value) => {
        if (value && typeof value === 'string' && value.startsWith('http')) {
          return (
            <img
              src={value}
              alt="QR Code"
              className="w-[50px] h-[50px] object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onImageClick(value)}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          );
        }
        return '-';
      }
    },
    {
      key: '센터위치',
      label: '센터위치',
      sortable: true,
      sortKey: '센터위치',
      render: (value) => formatCellValue(value)
    },
    {
      key: '자산위치',
      label: '자산위치',
      sortable: true,
      sortKey: '자산위치',
      render: (value) => formatCellValue(value)
    }
  ];
};

const CountAdminAuditHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [checklistData, setChecklistData] = useState<ChecklistDataItem[]>([]);
  const [filteredData, setFilteredData] = useState<ChecklistDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inputSearchTerm, setInputSearchTerm] = useState(''); // 입력 중인 검색어
  const [activeSearchTerm, setActiveSearchTerm] = useState(''); // 실제 검색에 사용되는 검색어
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'O' | 'X'>('all'); // 자산실사 여부 필터
  const [sortBy, setSortBy] = useState<string | null>('자산실사일');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isDownloading, setIsDownloading] = useState(false);
  const [showExcelDateFilter, setShowExcelDateFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  // user의 role을 메모이제이션하여 안정적인 참조 생성
  const isUserAdmin = useMemo(() => user && isAdmin(user), [user?.role]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setPageSize(mobile ? 9999 : 10);
      setCurrentPage(1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // 클라이언트 측 페이지네이션을 위해 전체 데이터를 가져옴
      const data = await getChecklistData({
        search: activeSearchTerm || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder,
        page: 1,
        pageSize: 9999 // 전체 데이터를 가져와서 클라이언트에서 페이지네이션
      });

      if (Array.isArray(data)) {
        setChecklistData(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setChecklistData(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to load checklist data:', err);
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [activeSearchTerm, sortBy, sortOrder]);

  useEffect(() => {
    // 권한 체크 (ProtectedAdminRoute에서 이미 체크하지만 이중 체크)
    if (!isUserAdmin) {
      alert('접근 권한이 없습니다.');
      navigate('/user', { replace: true });
      return;
    }
    loadData();
  }, [isUserAdmin, navigate, loadData]);

  // 자산실사 여부 필터링 함수
  const filterByAuditStatus = useCallback((data: ChecklistDataItem[], filter: 'all' | 'O' | 'X'): ChecklistDataItem[] => {
    if (filter === 'all') {
      return data;
    }

    return data.filter((item) => {
      const auditStatus = item['자산실사 여부'];

      if (filter === 'O') {
        // O인 경우: "O"이거나 true인 경우만
        return auditStatus === 'O' || auditStatus === true || String(auditStatus).toUpperCase() === 'O';
      } else if (filter === 'X') {
        // X인 경우: "X"이거나 false이거나 null이거나 "-"인 경우
        if (auditStatus === null || auditStatus === undefined || auditStatus === false) {
          return true;
        }
        const statusStr = String(auditStatus).trim();
        return statusStr === 'X' || statusStr === 'x' || statusStr === '-' || statusStr === '';
      }

      return true;
    });
  }, []);

  useEffect(() => {
    // 클라이언트 측 필터링 (자산실사 여부 필터 적용)
    const filtered = filterByAuditStatus(checklistData, auditStatusFilter);
    setFilteredData(filtered);
  }, [checklistData, auditStatusFilter, filterByAuditStatus]);


  const handleRefresh = () => {
    // 검색 조건 초기화
    setInputSearchTerm('');
    setActiveSearchTerm('');
    setAuditStatusFilter('all');
    setSortBy(null);
    setSortOrder('asc');
    setCurrentPage(1);
    // loadData는 useEffect에서 activeSearchTerm, sortBy, sortOrder 변경 시 자동 호출됨
  };

  const handleSearch = () => {
    setActiveSearchTerm(inputSearchTerm);
    setCurrentPage(1);
  };

  const parseDateLoose = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;

    const str = String(value).trim();
    if (!str) return null;

    // ISO / 브라우저가 파싱 가능한 형태
    const d1 = new Date(str);
    if (!Number.isNaN(d1.getTime())) return d1;

    // yyyy-mm-dd or yyyy/mm/dd 등
    const normalized = str.replace(/\./g, '-').replace(/\//g, '-').replace(/\s+/g, ' ');
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]) - 1;
      const day = Number(match[3]);
      const d2 = new Date(y, m, day);
      if (!Number.isNaN(d2.getTime())) return d2;
    }

    return null;
  };

  const filterByAuditDateRange = (rows: ChecklistDataItem[], dateFrom: string, dateTo: string) => {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return rows;

    return rows.filter((row) => {
      const d = parseDateLoose(row['자산실사일']);
      if (!d) return false;
      return d >= from && d <= to;
    });
  };

  const handleDownloadWithRange = async (range: ExcelDateRangeResult) => {
    try {
      setIsDownloading(true);

      // 중요: 다운로드는 "현재 페이지"가 아니라, 서버에서 전체 데이터를 가져와 조건으로 필터링
      const allRows = await getAllChecklistData({
        search: activeSearchTerm || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder,
        pageSize: 500
      });

      let rowsToDownload: ChecklistDataItem[] = allRows as ChecklistDataItem[];
      if (range.all === false) {
        rowsToDownload = filterByAuditDateRange(rowsToDownload, range.dateFrom, range.dateTo);
      }

      await downloadChecklistHistoryExcel(rowsToDownload);
      setShowExcelDateFilter(false);
    } catch (err: any) {
      alert(err.message || '엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  // 테이블 컬럼 설정 - early return 이전에 Hook 호출
  const tableColumns = useMemo(() => {
    const allColumns = getColumns(setExpandedImage);
    // 데이터에 해당 컬럼이 있는지 확인하여 필터링
    if (checklistData.length === 0) {
      return allColumns;
    }
    return allColumns.filter(col => checklistData[0].hasOwnProperty(col.key));
  }, [checklistData]);

  if (loading) {
    return <LoadingOverlay message="데이터를 불러오는 중..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-[85dvw] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-red-500 mb-2 tracking-tight">장비 점검, 실사, QR생성 서비스</h2>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight">마스터 파일 관리</h2>
      </div> 
      <div className="max-w-[85dvw] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">자산 실사내역 확인</h1>
            <p className="mt-2 text-gray-600">전체 {total}건{total > filteredData.length ? `, 필터링 ${filteredData.length}건` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button
              onClick={() => setShowExcelDateFilter(true)}
              disabled={isDownloading || filteredData.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? '다운로드 중...' : '엑셀 다운로드'}
            </button>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-col gap-2">
            {/* 검색 입력 */}
            <div className="relative flex-1 w-full flex items-center gap-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 " />
              <input
                type="text"
                placeholder="검색..."
                value={inputSearchTerm}
                onChange={(e) => setInputSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-1 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-fit"
              >
                검색
              </button>
            </div>
            {/* 자산실사 여부 필터 */}
            <div className="flex gap-2 justify-end items-center gap-4">
              <h2>자산 실사 여부</h2>
              <select
                value={auditStatusFilter}
                onChange={(e) => {
                  setAuditStatusFilter(e.target.value as 'all' | 'O' | 'X');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white w-[150px]"
              >
                <option value="all">전체</option>
                <option value="O">O</option>
                <option value="X">X</option>
              </select>
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <DataTable
          data={filteredData}
          columns={tableColumns}
          sortBy={sortBy || undefined}
          sortOrder={sortOrder}
          onSort={handleSort}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 15, 30, 50]}
          keyExtractor={(row, index) => {
            const assetNo = String(row['자산번호'] || '');
            const mgmtNo = String(row['관리번호'] || '');
            const rowIdx = row._rowIndex || index;
            return `${assetNo}-${mgmtNo}-${rowIdx}-${index}`;
          }}
          emptyMessage="데이터가 없습니다."
          showPagination={!isMobile}
        />
      </div>

      <ExcelDateRangeModal
        isOpen={showExcelDateFilter}
        onClose={() => setShowExcelDateFilter(false)}
        onConfirm={handleDownloadWithRange}
        isDownloading={isDownloading}
      />

      {/* 이미지 확대 모달 */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setExpandedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            onClick={() => setExpandedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={expandedImage}
            alt="확대된 QR Code"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default CountAdminAuditHistoryPage;

