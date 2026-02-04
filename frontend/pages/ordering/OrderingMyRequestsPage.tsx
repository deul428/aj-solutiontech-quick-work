import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, FileText, Search, Filter, Eye, X, CheckCircle2, Download, Calendar } from 'lucide-react';
import { Request } from '../../types/ordering';
import {
  getMyRequestsOrdering,
  cancelRequestOrdering,
  confirmReceiptOrdering,
  downloadMyRequestsExcel,
  PaginatedResult,
  ORDERING_GAS_URL
} from '../../services/orderingService';
import { getSessionToken } from '../../utils/orderingAuth';
import { formatDate, getStatusColor, getDateRange, preloadImage } from '../../utils/orderingHelpers';
import requestCache from '../../utils/orderingCache';
import LoadingOverlay from '../../components/LoadingOverlay';
import DataTable, { TableColumn } from '../../components/DataTable';
import Toast from '../../components/Toast';
import Header from '@/components/Header';

interface OrderingMyRequestsPageProps {
  onNavigate?: (view: string, requestNo?: string) => void;
}

type SortField = 'requestNo' | 'status' | 'requestDate' | null;
type SortDirection = 'asc' | 'desc';

const OrderingMyRequestsPage: React.FC<OrderingMyRequestsPageProps> = ({ onNavigate }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('requestDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [processing, setProcessing] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 모바일 감지 (초기값은 window가 있을 때만 체크)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // Tailwind md breakpoint
    }
    return false;
  });

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  // PC: 15건씩, 모바일: 페이징 없이 전체 표시 (성능 최적화를 위해 큰 값 사용)
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 9999 : 10; // 모바일은 페이징 없음
    }
    return 10;
  });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 모바일/PC 전환 시 pageSize 업데이트
      if (mobile) {
        setPageSize(9999); // 모바일: 페이징 없음
      } else {
        setPageSize(10); // PC: 10건씩
      }
      setCurrentPage(1); // 페이지 리셋
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 기간 필터 상태
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showExcelDateFilter, setShowExcelDateFilter] = useState(false);
  const [excelDateFrom, setExcelDateFrom] = useState<string>('');
  const [excelDateTo, setExcelDateTo] = useState<string>('');
  const [excelDateRangeAll, setExcelDateRangeAll] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [dateFrom, dateTo]); // 클라이언트 페이징을 위해 currentPage, pageSize, isMobile 제거

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter, searchTerm, sortField, sortDirection]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        }
        return;
      }

      if (!ORDERING_GAS_URL) {
        console.warn('ORDERING_GAS_URL이 설정되지 않았습니다.');
        setRequests([]);
        return;
      }

      // 클라이언트 측 페이징을 위해 전체 데이터를 가져옴
      const filter: any = {
        page: 1,
        pageSize: 9999, // 전체 데이터를 가져옴
        sortBy: sortField || 'requestDate',
        sortOrder: sortDirection
      };

      if (dateFrom) filter.dateFrom = dateFrom;
      if (dateTo) filter.dateTo = dateTo;

      const result = await getMyRequestsOrdering(ORDERING_GAS_URL, filter, sessionToken);

      // result가 배열이면 그대로 사용, 객체면 result.data 사용
      const newRequests = Array.isArray(result) ? result : (result.data || []);

      console.log('loadRequests: 데이터 로드 완료', newRequests.length, '건');
      console.log('loadRequests: result 타입', Array.isArray(result) ? '배열' : '객체');
      if (!Array.isArray(result) && result.data) {
        console.log('loadRequests: result.data 길이', result.data.length);
      }

      setRequests(newRequests);
      setTotal(newRequests.length);
      setTotalPages(1);

      // 캐시에 저장
      requestCache.setMany(newRequests);
    } catch (err: any) {
      setError(err.message || '신청 목록 로딩 실패');
      setRequests([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = [...requests];

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // 검색 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(req =>
        String(req.requestNo || '').toLowerCase().includes(term) ||
        String(req.itemName || '').toLowerCase().includes(term) ||
        (req.assetNo && String(req.assetNo).toLowerCase().includes(term))
      );
    }

    // 정렬은 DataTable에서 처리하므로 여기서는 제거
    setFilteredRequests(filtered);
  };

  // 정렬된 데이터 (클라이언트 측 정렬)
  const sortedAndFilteredRequests = useMemo(() => {
    let sorted = [...filteredRequests];

    if (sortField) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'requestNo':
            aValue = a.requestNo || '';
            bValue = b.requestNo || '';
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
            break;
          case 'requestDate':
            aValue = new Date(a.requestDate || 0).getTime();
            bValue = new Date(b.requestDate || 0).getTime();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return sorted;
  }, [filteredRequests, sortField, sortDirection]);

  const handleSort = (key: string) => {
    const field = key as SortField;
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const canCancel = (status: string) => {
    return status === '접수중';
  };

  const canConfirmReceipt = (status: string) => {
    return status === '발주완료(납기확인)' || status === '발주완료(납기미정)';
  };

  // 테이블 컬럼 설정 - 여기서 쉽게 헤더 관리 가능
  const columns: TableColumn<Request>[] = useMemo(() => [
    {
      key: 'requestNo',
      label: '신청번호',
      sortable: true,
      sortKey: 'requestNo',
      render: (value) => <span className="font-black text-blue-600">{value}</span>
    },
    {
      key: 'itemName',
      label: '품명',
      sortable: false,
      render: (value) => <span className="font-bold">{value}</span>
    },
    {
      key: 'quantity',
      label: '수량',
      sortable: false,
      render: (value) => <span className="font-bold">{value}</span>
    },
    {
      key: 'assetNo',
      label: '관리번호',
      sortable: false,
      render: (value) => <span className="font-bold text-gray-600">{value || '-'}</span>
    },
    {
      key: 'status',
      label: '상태',
      sortable: true,
      sortKey: 'status',
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-xs font-black ${getStatusColor(value)}`}>
          {value}
        </span>
      )
    },
    {
      key: 'requestDate',
      label: '신청일',
      sortable: true,
      sortKey: 'requestDate',
      render: (value) => <span className="font-bold text-gray-600">{formatDate(value, 'date')}</span>
    },
    {
      key: 'actions',
      label: '작업',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetail(row.requestNo)}
            className="flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-bold transition-colors"
          >
            <Eye className="w-4 h-4" />
            상세
          </button>
          {canCancel(row.status) && (
            <button
              onClick={() => handleCancel(row.requestNo)}
              disabled={processing === row.requestNo}
              className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              취소
            </button>
          )}
          {canConfirmReceipt(row.status) && (
            <button
              onClick={() => handleConfirmReceipt(row.requestNo)}
              disabled={processing === row.requestNo}
              className="flex items-center gap-1 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-bold transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              수령 확인
            </button>
          )}
        </div>
      )
    }
  ], [processing]);

  const handleViewDetail = (requestNo: string) => {
    // 해당 신청의 이미지를 프리로딩
    const request = requests.find(r => r.requestNo === requestNo);
    if (request && request.photoUrl) {
      // 프리로딩 시작 (비동기, 블로킹하지 않음)
      preloadImage(request.photoUrl).catch(() => {
        // 프리로딩 실패해도 상세 페이지는 정상 진입
      });
    }

    if (onNavigate) {
      onNavigate('ordering-detail', requestNo);
    }
  };

  const handleCancel = async (requestNo: string) => {
    if (!confirm('정말로 이 신청을 취소하시겠습니까?')) {
      return;
    }

    try {
      setProcessing(requestNo);
      setError('');
      setSuccess('');

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        }
        return;
      }

      if (!ORDERING_GAS_URL) {
        throw new Error('GAS URL이 설정되지 않았습니다.');
      }

      const result = await cancelRequestOrdering(ORDERING_GAS_URL, requestNo, sessionToken);

      if (result.success) {
        await loadRequests(); // 목록 새로고침
        // 데이터 동기화 완료 후 toast 메시지 표시
        setToast({ message: result.message || '신청이 취소되었습니다.', type: 'success' });
      } else {
        setError(result.message || '취소 처리에 실패했습니다.');
        setToast({ message: result.message || '취소 처리에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setError(err.message || '취소 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const handleConfirmReceipt = async (requestNo: string) => {
    if (!confirm('수령 확인을 하시겠습니까?')) {
      return;
    }

    try {
      setProcessing(requestNo);
      setError('');
      setSuccess('');

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        }
        return;
      }

      if (!ORDERING_GAS_URL) {
        throw new Error('GAS URL이 설정되지 않았습니다.');
      }

      const result = await confirmReceiptOrdering(ORDERING_GAS_URL, requestNo, sessionToken);

      if (result.success) {
        await loadRequests(); // 목록 새로고침
        // 데이터 동기화 완료 후 toast 메시지 표시
        setToast({ message: result.message || '수령 확인이 완료되었습니다.', type: 'success' });
      } else {
        setError(result.message || '수령 확인 처리에 실패했습니다.');
        setToast({ message: result.message || '수령 확인 처리에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setError(err.message || '수령 확인 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const goBack = () => {
    if (onNavigate) {
      onNavigate('ordering');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        }
        return;
      }

      if (!ORDERING_GAS_URL) {
        throw new Error('GAS URL이 설정되지 않았습니다.');
      }

      // 기간 필터가 설정되어 있으면 사용, 없으면 모달 표시
      if (!excelDateRangeAll && (!excelDateFrom || !excelDateTo)) {
        setShowExcelDateFilter(true);
        return;
      }

      // 실제 다운로드 실행
      await executeDownload();
    } catch (err: any) {
      setError(err.message || '엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  const executeDownload = async () => {
    try {
      setIsDownloading(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        }
        return;
      }

      if (!ORDERING_GAS_URL) {
        throw new Error('GAS URL이 설정되지 않았습니다.');
      }

      // 전체 다운로드인 경우 빈 값 전달, 아니면 기간 필터 전달
      await downloadMyRequestsExcel(
        ORDERING_GAS_URL,
        sessionToken,
        excelDateRangeAll ? undefined : excelDateFrom,
        excelDateRangeAll ? undefined : excelDateTo
      );
      setSuccess('엑셀 파일이 다운로드되었습니다.');
      setShowExcelDateFilter(false);
    } catch (err: any) {
      setError(err.message || '엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleQuickDateFilter = (period: 'today' | 'thisWeek' | 'thisMonth' | 'last3Months') => {
    const range = getDateRange(period);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setCurrentPage(1); // 첫 페이지로 리셋
  };

  const handleQuickExcelDateFilter = (period: 'today' | 'thisWeek' | 'thisMonth' | 'last3Months' | 'all') => {
    if (period === 'all') {
      setExcelDateFrom('');
      setExcelDateTo('');
      setExcelDateRangeAll(true);
    } else {
      const range = getDateRange(period);
      setExcelDateFrom(range.dateFrom);
      setExcelDateTo(range.dateTo);
      setExcelDateRangeAll(false);
    }
  };

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const clearExcelDateFilter = () => {
    setExcelDateFrom('');
    setExcelDateTo('');
    setExcelDateRangeAll(false);
  };

  if (loading) {
    return <LoadingOverlay message="신청 목록 로딩 중..." />;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-12 px-4 md:px-6">
      {/* 헤더 */}
      <Header headerTitle="내 신청 목록 조회" headerSubTitle="부품 발주 시스템" level={2} /> 
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 font-bold text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-700 font-bold text-sm">{success}</p>
        </div>
      )}

      {processing && (
        <LoadingOverlay message="처리 중..." />
      )}

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 mb-6">
        <div className="flex flex-col gap-4">
          {/* 검색 및 상태 필터 */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="신청번호, 품명, 관리번호로 검색..."
                className="w-full text-sm pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 상태 필터 */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold w-full sm:w-auto"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">전체 상태</option>
                <option value="접수중">접수중</option>
                <option value="발주진행">발주진행</option>
                <option value="발주완료(납기확인)">발주완료(납기확인)</option>
                <option value="발주완료(납기미정)">발주완료(납기미정)</option>
                <option value="처리완료">처리완료</option>
                <option value="접수취소">접수취소</option>
              </select>
            </div>
          </div>

          {/* 기간 필터 */}
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center hidden">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-bold text-gray-600">기간:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickDateFilter('today')}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${dateFrom && dateTo && dateFrom === getDateRange('today').dateFrom
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                오늘
              </button>
              <button
                onClick={() => handleQuickDateFilter('thisWeek')}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${dateFrom && dateTo && dateFrom === getDateRange('thisWeek').dateFrom
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                이번 주
              </button>
              <button
                onClick={() => handleQuickDateFilter('thisMonth')}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${dateFrom && dateTo && dateFrom === getDateRange('thisMonth').dateFrom
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                이번 달
              </button>
              <button
                onClick={() => handleQuickDateFilter('last3Months')}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${dateFrom && dateTo && dateFrom === getDateRange('last3Months').dateFrom
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                최근 3개월
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="시작일"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="종료일"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={clearDateFilter}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-bold transition-colors"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 신청 목록 */}
      <div className="bg-white rounded-2xl md:rounded-2xl shadow-2xl border border-gray-100 p-4 md:p-6 sm:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            <h2 className="text-lg md:text-xl font-black text-gray-800">
              신청 내역 ({sortedAndFilteredRequests.length}건)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* 페이지 크기 선택 (PC만) */}
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors text-sm md:text-base"
            >
              <Download className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">엑셀 다운로드</span>
              <span className="sm:hidden">다운로드</span>
            </button>
          </div>
        </div>

        {sortedAndFilteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bold text-lg">
              {searchTerm || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '신청 내역이 없습니다.'}
            </p>
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 뷰 */}
            <div className="hidden lg:block">
              <DataTable
                data={sortedAndFilteredRequests}
                columns={columns}
                sortBy={sortField || undefined}
                sortOrder={sortDirection}
                onSort={handleSort}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 15, 30, 50]}
                keyExtractor={(row) => row.requestNo}
                emptyMessage="신청 내역이 없습니다."
                showPagination={!isMobile}
              />
            </div>

            {/* 모바일 카드 뷰 */}
            <div className="lg:hidden space-y-4">
              {sortedAndFilteredRequests.map((req) => (
                <div
                  key={req.requestNo}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-blue-600 text-lg">{req.requestNo}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(req.requestDate, 'date')}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black max-w-[100px] sm:max-w-none ml-4 sm:ml-0 ${getStatusColor(req.status)} text-center`}>
                      {req.status && req.status.length > 4 ? req.status.slice(0, 4) : req.status}
                      {req.status && req.status.length > 4 ? <><br />{req.status.slice(4, req.status.length)}</> : null}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-gray-500">품명</span>
                      <span className="text-sm font-black text-gray-800">{req.itemName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-gray-500">수량</span>
                      <span className="text-sm font-black text-gray-800">{req.quantity}</span>
                    </div>
                    {req.assetNo && (
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-gray-500">관리번호</span>
                        <span className="text-sm font-black text-gray-800">{req.assetNo}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleViewDetail(req.requestNo)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-bold transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      상세
                    </button>
                    {canCancel(req.status) && (
                      <button
                        onClick={() => handleCancel(req.requestNo)}
                        disabled={processing === req.requestNo}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
                      >
                        <X className="w-4 h-4" />
                        취소
                      </button>
                    )}
                    {canConfirmReceipt(req.status) && (
                      <button
                        onClick={() => handleConfirmReceipt(req.requestNo)}
                        disabled={processing === req.requestNo}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        수령 확인
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      {/* 엑셀 다운로드 기간 선택 모달 */}
      {showExcelDateFilter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-black text-gray-800 mb-4">엑셀 다운로드 기간 선택</h3>

            <div className="space-y-4">
              {/* 퀵 버튼 */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">빠른 선택</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5  gap-2">
                  <button
                    onClick={() => handleQuickExcelDateFilter('today')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${excelDateFrom && excelDateFrom === getDateRange('today').dateFrom
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    오늘
                  </button>
                  <button
                    onClick={() => handleQuickExcelDateFilter('thisWeek')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${excelDateFrom && excelDateFrom === getDateRange('thisWeek').dateFrom
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    이번 주
                  </button>
                  <button
                    onClick={() => handleQuickExcelDateFilter('thisMonth')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${excelDateFrom && excelDateFrom === getDateRange('thisMonth').dateFrom
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    이번 달
                  </button>
                  <button
                    onClick={() => handleQuickExcelDateFilter('last3Months')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${excelDateFrom && excelDateFrom === getDateRange('last3Months').dateFrom
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    최근 3개월
                  </button>
                  <button
                    onClick={() => handleQuickExcelDateFilter('all')}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${excelDateRangeAll
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    전체
                  </button>
                </div>
              </div>

              {/* 전체 선택 시 경고 문구 */}
              {excelDateRangeAll && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                  <p className="text-yellow-800 text-sm font-bold">
                    ⚠️ 전체 다운로드 시 데이터가 많을 경우 다운로드가 느려질 수 있습니다.
                  </p>
                </div>
              )}

              {/* 커스텀 기간 선택 */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">기간 직접 선택</label>
                <div className="flex items-center gap-2 flex-col sm:flex-row ">
                  <input
                    type="date"
                    value={excelDateFrom}
                    onChange={(e) => setExcelDateFrom(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="date"
                    value={excelDateTo}
                    onChange={(e) => setExcelDateTo(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowExcelDateFilter(false);
                  clearExcelDateFilter();
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeDownload}
                disabled={(!excelDateRangeAll && (!excelDateFrom || !excelDateTo)) || isDownloading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? '다운로드 중...' : '다운로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 메시지 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default OrderingMyRequestsPage;


