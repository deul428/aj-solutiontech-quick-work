import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, CheckCircle2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Request } from '../../types/ordering';
import {
  getRequestDetailOrdering,
  cancelRequestOrdering,
  confirmReceiptOrdering,
  updateRequesterRemarksOrdering,
  ORDERING_GAS_URL
} from '../../services/orderingService';
import { getSessionToken } from '../../utils/orderingAuth';
import { formatDate, getStatusColor, getImageUrl } from '../../utils/orderingHelpers';
import requestCache from '../../utils/orderingCache';
import LoadingOverlay from '../../components/LoadingOverlay';
import Toast from '../../components/Toast';

interface OrderingRequestDetailPageProps {
  requestNo?: string;
  onNavigate?: (view: string) => void;
}

const OrderingRequestDetailPage: React.FC<OrderingRequestDetailPageProps> = ({ requestNo: propRequestNo, onNavigate }) => {
  const { requestNo: paramRequestNo } = useParams<{ requestNo: string }>();
  const requestNo = paramRequestNo || propRequestNo;
  const navigate = useNavigate();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [requesterRemarks, setRequesterRemarks] = useState('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    if (requestNo) {
      loadRequestDetail();
    }
  }, [requestNo]);

  const loadRequestDetail = async () => {
    try {
      setLoading(true);
      setError('');

      if (!requestNo) {
        setError('신청번호가 없습니다.');
        setLoading(false);
        return;
      }

      // 캐시에서 먼저 확인
      const cachedRequest = requestCache.get(requestNo);
      if (cachedRequest) {
        // 캐시에 있으면 즉시 표시
        setRequest(cachedRequest);
        setLoading(false);
        // 백그라운드에서 최신 데이터 확인 (선택적)
        // 목록에서 새로고침될 때 캐시가 갱신되므로 여기서는 API 호출 생략
        return;
      }

      // 캐시에 없으면 API 호출
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        }
        return;
      }

      if (!ORDERING_GAS_URL) {
        setError('GAS URL이 설정되지 않았습니다.');
        setLoading(false);
        return;
      }

      const data = await getRequestDetailOrdering(ORDERING_GAS_URL, requestNo, sessionToken);

      if (data) {
        setRequest(data);
        setRequesterRemarks(data.remarks || '');
        // 캐시에 저장 (다음에 빠르게 접근 가능)
        requestCache.set(requestNo, data);
      } else {
        setError('신청 내역을 찾을 수 없습니다.');
      }
    } catch (err: any) {
      setError(err.message || '신청 상세 정보 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!requestNo || !request?.canCancel) return;

    if (!confirm('정말로 이 신청을 취소하시겠습니까?')) {
      return;
    }

    try {
      setProcessing(true);
      setError('');

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
        setToast({ message: result.message || '신청이 취소되었습니다.', type: 'success' });
        setTimeout(() => {
          if (onNavigate) {
            onNavigate('ordering-requests');
          }
        }, 1500);
      } else {
        setError(result.message || '취소 처리에 실패했습니다.');
        setToast({ message: result.message || '취소 처리에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setError(err.message || '취소 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!requestNo || !request?.canConfirmReceipt) return;

    if (!confirm('수령 확인을 하시겠습니까?')) {
      return;
    }

    try {
      setProcessing(true);
      setError('');

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
        loadRequestDetail(); // 데이터 새로고침
        setToast({ message: result.message || '수령 확인이 완료되었습니다.', type: 'success' });
      } else {
        setError(result.message || '수령 확인 처리에 실패했습니다.');
        setToast({ message: result.message || '수령 확인 처리에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setError(err.message || '수령 확인 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => {
    if (onNavigate) {
      onNavigate('ordering-requests');
    } else {
      navigate('/ordering/requests');
    }
  };

  // 신청자 비고 저장
  const saveRequesterRemarks = async () => {
    if (!request) return;

    try {
      setProcessing(true);
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('ordering-login');
        } else {
          navigate('/login');
        }
        return;
      }

      const result = await updateRequesterRemarksOrdering(
        ORDERING_GAS_URL,
        request.requestNo,
        requesterRemarks,
        sessionToken
      );

      if (result.success) {
        await loadRequestDetail();
        setToast({ message: result.message || '신청자 비고가 저장되었습니다.', type: 'success' });
      } else {
        setError(result.message || '비고 저장에 실패했습니다.');
        setToast({ message: result.message || '비고 저장에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setError(err.message || '비고 저장 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  // 이미지 로드 완료 핸들러
  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  // 이미지 에러 핸들러
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    const originalUrl = request?.photoUrl || '';

    // 파일 ID 추출
    let fileId = '';
    if (originalUrl.includes('drive.google.com')) {
      const match1 = originalUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match1 && match1[1]) {
        fileId = match1[1];
      } else {
        const match2 = originalUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match2 && match2[1]) {
          fileId = match2[1];
        }
      }
    }

    // 대체 URL 시도 (여러 방법 순차 시도)
    if (fileId) {
      // 시도 1: lh3.googleusercontent.com이 실패한 경우, export=view 시도
      if (img.src.includes('lh3.googleusercontent.com')) {
        img.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
        return;
      }

      // 시도 2: export=view가 실패한 경우, 썸네일 링크 시도
      if (img.src.includes('export=view')) {
        img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800-h600`;
        return;
      }

      // 시도 3: 썸네일이 실패한 경우, 다운로드 링크 시도
      if (img.src.includes('thumbnail')) {
        img.src = `https://drive.google.com/uc?export=download&id=${fileId}`;
        return;
      }
    }

    // 모든 시도 실패
    setImageLoading(false);
    setImageError(true);
  };

  // request가 변경될 때 이미지 로딩 상태 초기화
  useEffect(() => {
    if (request?.photoUrl) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [request?.photoUrl]);

  if (loading) {
    return <LoadingOverlay message="신청 상세 정보 로딩 중..." />;
  }

  if (!request) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-bold">{error || '신청 내역을 찾을 수 없습니다.'}</p>
          <button
            onClick={goBack}
            className="mt-4 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {processing && <LoadingOverlay message="처리 중..." />}

        {/* 헤더 */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">신청 상세 정보</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 기본 정보 테이블 */}
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">기본 정보</h2>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50 w-1/4">
                      신청 번호
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.requestNo}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      신청 일시
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.requestDate}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      신청자
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div>
                        <p className="font-medium">{request.requesterName}</p>
                        <p className="text-xs text-gray-500 mt-1">{request.region} - {request.team}</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      현재 상태
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 align-top text-sm font-medium text-gray-500 bg-gray-50">
                      신청자 비고
                    </td>
                    <td className="px-4 py-4">
                      <textarea
                        value={requesterRemarks || request?.remarks}
                        onChange={(e) => setRequesterRemarks(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={4}
                        placeholder="비고를 입력하세요"
                      />
                      <button
                        onClick={saveRequesterRemarks}
                        disabled={processing}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors w-full sm:w-auto"
                      >
                        {processing ? '저장 중...' : '비고 저장'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 부품 정보 테이블 */}
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">부품 정보</h2>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50 w-1/4">
                      부품 품명
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.itemName}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      모델명
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.modelName || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      수량
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.quantity}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      수령지
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.deliveryPlace}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      수령 연락처
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.phone || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50">
                      업체명
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.company || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 첨부사진 */}
            {request.photoUrl && (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800">첨부사진</h2>
                </div>
                <div className="p-6 bg-white">
                  <div className="flex justify-center relative">
                    {imageError ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-gray-100 rounded-lg min-h-[200px]">
                        <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                        <a
                          href={request.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-xs text-blue-600 hover:underline"
                        >
                          원본 링크로 열기
                        </a>
                      </div>
                    ) : (
                      <>
                        <img
                          src={getImageUrl(request.photoUrl)}
                          alt="첨부사진"
                          className="max-h-[300px] h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md"
                          onClick={() => setExpandedImage(getImageUrl(request.photoUrl!))}
                          onLoad={handleImageLoad}
                          onError={handleImageError}
                        />
                        {imageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {!imageError && (
                    <p className="text-xs text-gray-500 text-center mt-2">클릭하면 원본 크기로 확대됩니다</p>
                  )}
                </div>
              </div>
            )}

            {/* 접수 담당자 및 비고 */}
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">접수 담당자 및 비고</h2>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-500 bg-gray-50 w-1/4">
                      접수 담당자
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.handler || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 align-top text-sm font-medium text-gray-500 bg-gray-50">
                      접수 담당자 비고
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {request.handlerRemarks || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={goBack}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                목록으로
              </button>
              {/* {request.canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  취소하기
                </button>
              )} */}
              {request.canConfirmReceipt && (
                <button
                  onClick={handleConfirmReceipt}
                  disabled={processing}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  수령 확인
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 확대된 이미지 모달 */}
        {expandedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]"
            onClick={() => setExpandedImage(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]">
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={expandedImage}
                alt="확대된 이미지"
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>

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

export default OrderingRequestDetailPage;

