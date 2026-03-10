import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Upload, X, AlertCircle, Camera } from 'lucide-react';
import { User, DeliveryPlace } from '../../types/ordering';
import {
  getDeliveryPlacesOrdering,
  createRequestOrdering,
  ORDERING_GAS_URL
} from '../../services/orderingService';
import { getCurrentUser, getSessionToken } from '../../utils/orderingAuth';
import LoadingOverlay from '../../components/LoadingOverlay';
import Toast from '../../components/Toast';
import Header from '@/components/Header';
import Button from '@/components/Button';
import { MAX_PHOTO_COUNT } from '../../constants/orderingPhoto';

interface OrderingNewRequestPageProps {
  onNavigate?: (view: string) => void;
}

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const OrderingNewRequestPage: React.FC<OrderingNewRequestPageProps> = ({ onNavigate }) => {
  const [user] = useState<User | null>(getCurrentUser());
  const [deliveryPlaces, setDeliveryPlaces] = useState<DeliveryPlace[]>([]);
  const [formData, setFormData] = useState({
    itemName: '',
    modelName: '',
    serialNo: '',
    quantity: 1,
    assetNo: '',
    deliveryPlace: '',
    customDeliveryPlace: '',
    phone: '',
    company: '',
    remarks: '',
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [showCustomDelivery, setShowCustomDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [success, setSuccess] = useState('');
  const photoSelectInputRef = useRef<HTMLInputElement | null>(null);
  const photoCaptureInputRef = useRef<HTMLInputElement | null>(null);

  const showRequiredFieldAlert = (label: string) => {
    alert(`${label} 란을 입력하세요.`);
  };

  const handleCameraCaptureClick = async () => {
    try {
      const md = navigator.mediaDevices;
      if (!md?.enumerateDevices) {
        setToast({ message: '카메라를 찾지 못했습니다.', type: 'error' });
        return;
      }

      const devices = await md.enumerateDevices();
      // 일부 브라우저/환경에서는 권한 이슈로 빈 배열이 나올 수 있어,
      // "목록이 있을 때만" 카메라 존재 여부를 확정적으로 판단합니다.
      if (devices.length > 0) {
        const hasCamera = devices.some((d) => d.kind === 'videoinput');
        if (!hasCamera) {
          setToast({ message: '카메라를 찾지 못했습니다.', type: 'error' });
          return;
        }
      }

      const el = photoCaptureInputRef.current;
      if (!el) return;
      el.value = '';
      el.click();
    } catch (e) {
      setToast({ message: '카메라를 찾지 못했습니다.', type: 'error' });
    }
  };

  const handleFileSelectClick = () => {
    const el = photoSelectInputRef.current;
    if (!el) return;
    el.value = '';
    el.click();
  };

  const focusFieldByName = (name: string) => {
    // name 기반으로 input/select/textarea 찾아서 포커스
    const el = document.querySelector<HTMLElement>(`[name="${name}"]`);
    if (el && "focus" in el) {
      (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      if (!user) {
        if (onNavigate) {
          onNavigate('login');
        }
        return;
      }
      if (!ORDERING_GAS_URL) {
        console.warn('ORDERING_GAS_URL이 설정되지 않았습니다.');
        return;
      }

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('login');
        }
        return;
      }
      const places = await getDeliveryPlacesOrdering(ORDERING_GAS_URL, user.team, sessionToken);
      if (Array.isArray(places)) {
        setDeliveryPlaces(places);
      }
    } catch (err: any) {
      setToast({ message: err.message || '데이터 로딩 실패', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'deliveryPlace' && value === '기타') {
      setShowCustomDelivery(true);
    } else if (name === 'deliveryPlace') {
      setShowCustomDelivery(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0) return;

    const remainingSlots = MAX_PHOTO_COUNT - photoFiles.length;
    if (remainingSlots <= 0) {
      alert(`사진은 최대 ${MAX_PHOTO_COUNT}장까지 첨부할 수 있습니다.`);
      return;
    }

    const oversizedFile = selectedFiles.find((file: File) => file.size > MAX_PHOTO_SIZE_BYTES);
    if (oversizedFile) {
      alert(`"${oversizedFile.name}" 파일 크기는 5MB를 초과할 수 없습니다.`);
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      alert(`최대 ${MAX_PHOTO_COUNT}장까지 첨부할 수 있어 일부 파일만 추가됩니다.`);
    }

    const nextFiles = [...photoFiles, ...filesToAdd];
    setPhotoFiles(nextFiles);

    Promise.all(
      nextFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = () => reject(new Error('이미지 미리보기 생성에 실패했습니다.'));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((previews) => setPhotoPreviews(previews))
      .catch(() => {
        setToast({ message: '이미지 미리보기 생성 중 오류가 발생했습니다.', type: 'error' });
      });
  };

  const removePhoto = (indexToRemove: number) => {
    const nextFiles = photoFiles.filter((_, index) => index !== indexToRemove);
    const nextPreviews = photoPreviews.filter((_, index) => index !== indexToRemove);
    setPhotoFiles(nextFiles);
    setPhotoPreviews(nextPreviews);
  };

  // 이미지 압축 함수 (점진적 압축으로 URL 길이 제한 해결)
  const compressImage = (file: File, maxWidth: number = 600, maxHeight: number = 600, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 비율 유지하면서 리사이즈
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 가져올 수 없습니다.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // JPEG로 변환 (품질 조정)
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64.split(',')[1]); // data:image/jpeg;base64, 제거
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // data:image/jpeg;base64, 제거
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    setSuccess('');

    // required 필드 수동 검증 (브라우저 기본 required 경고 대신 토스트 표시)
    const requiredFields: Array<{ name: string; label: string; isMissing: () => boolean }> = [
      { name: "itemName", label: "품명", isMissing: () => !formData.itemName?.trim() },
      { name: "quantity", label: "수량", isMissing: () => !formData.quantity || Number(formData.quantity) < 1 },
      { name: "assetNo", label: "관리번호", isMissing: () => !formData.assetNo?.trim() },
    ];

    // 배송지 '기타' 선택 시 직접 입력은 필수로 처리
    if (formData.deliveryPlace === "기타") {
      requiredFields.push({
        name: "customDeliveryPlace",
        label: "배송지 직접 입력",
        isMissing: () => !formData.customDeliveryPlace?.trim(),
      });
    }

    const firstMissing = requiredFields.find((f) => f.isMissing());
    if (firstMissing) {
      showRequiredFieldAlert(firstMissing.label);
      focusFieldByName(firstMissing.name);
      return;
    }

    // 사진은 필수
    if (photoFiles.length === 0) {
      alert('사진을 첨부해 주세요.');
      return;
    }

    setSubmitting(true);

    try {
      if (!ORDERING_GAS_URL) {
        throw new Error('GAS URL이 설정되지 않았습니다.');
      }

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        if (onNavigate) {
          onNavigate('login');
        }
        return;
      }

      // 사진을 점진적으로 압축하여 Base64(Data URL)로 변환
      const maxPhotoDataUrlLength = 150000;
      const compressionSettings = [
        { width: 400, height: 400, quality: 0.5 },
        { width: 300, height: 300, quality: 0.4 },
        { width: 250, height: 250, quality: 0.3 },
        { width: 200, height: 200, quality: 0.25 },
      ];

      const photoUrls: string[] = [];

      for (const file of photoFiles) {
        let photoUrl = '';
        let lastError: Error | null = null;

        for (const setting of compressionSettings) {
          try {
            const photoBase64 = await compressImage(file, setting.width, setting.height, setting.quality);
            const dataUrl = `data:image/jpeg;base64,${photoBase64}`;

            if (dataUrl.length <= maxPhotoDataUrlLength) {
              photoUrl = dataUrl;
              break;
            }
          } catch (compressError: any) {
            lastError = compressError;
            console.error(`압축 실패 (${setting.width}x${setting.height}, quality: ${setting.quality}):`, compressError);
          }
        }

        if (!photoUrl) {
          if (lastError) {
            throw new Error(`"${file.name}" 이미지 압축에 실패했습니다. 더 작은 이미지를 사용해 주세요.`);
          }
          throw new Error(`"${file.name}" 이미지가 너무 큽니다. 더 작은 이미지를 사용해 주세요.`);
        }

        photoUrls.push(photoUrl);
      }

      // 신청 데이터 제출
      const requestData = {
        ...formData,
        deliveryPlace: formData.deliveryPlace === '기타' ? formData.customDeliveryPlace : formData.deliveryPlace,
        photoUrl: photoUrls[0], // 하위 호환용
        photoUrls: photoUrls,
      };

      const result = await createRequestOrdering(ORDERING_GAS_URL, requestData, sessionToken);

      if (result.success) {
        alert(result.message || '신청이 완료되었습니다.');
        if (onNavigate) {
          onNavigate('ordering');
        }
      } else {
        setToast({ message: result.message || '신청 처리에 실패했습니다.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || '신청 처리 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (onNavigate) {
      onNavigate('ordering');
    }
  };

  if (!user) {
    return null; // 로그인 페이지로 리다이렉트 중
  }

  if (loading) {
    return <LoadingOverlay message="페이지 로딩 중..." />;
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      {submitting && <LoadingOverlay message="신청 처리 중..." />}

      {/* 헤더 */}
      <Header headerTitle="새 신청 등록" headerSubTitle="부품 발주" level={2} />
      {/* {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700 font-bold text-sm">{error}</p>
          </div>
        </div>
      )} */}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="text-green-700 font-bold text-sm">{success}</p>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* 신청자 정보 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 mb-4">신청자 정보</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">이름</label>
              <input
                type="text"
                value={user.name}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">소속 지역</label>
              <input
                type="text"
                value={user.region}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">소속 팀</label>
              <input
                type="text"
                value={user.team}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* 부품 정보 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 mb-4">부품 정보</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                품명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="itemName"
                label="품명"
                placeholder="예: 연료필터"
                value={formData.itemName}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">규격</label>
              <input
                type="text"
                name="modelName"
                label="규격"
                placeholder="예: HD-123"
                value={formData.modelName}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                수량 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="quantity"
                label="수량"
                min="1"
                value={formData.quantity}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                관리번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="assetNo"
                label="관리번호"
                placeholder="예: DS25C305"
                value={formData.assetNo}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">시리얼번호</label>
              <input
                type="text"
                name="serialNo"
                label="시리얼번호"
                placeholder="예: SN-12345"
                value={formData.serialNo}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* 수령 정보 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 mb-4">수령 정보</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">배송지</label>
              <select
                name="deliveryPlace"
                value={formData.deliveryPlace}
                onChange={handleInputChange}
              >
                <option value="">수령 배송지 선택</option>
                {deliveryPlaces.map((place, idx) => (
                  <option key={idx} value={place.name || place['배송지명']}>
                    {place.name || place['배송지명']}
                  </option>
                ))}
                <option value="기타">기타 (직접 입력)</option>
              </select>
            </div>
            {showCustomDelivery && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">배송지 직접 입력</label>
                <input
                  type="text"
                  name="customDeliveryPlace"
                  label="배송지 직접 입력"
                  placeholder="배송지를 입력하세요"
                  value={formData.customDeliveryPlace}
                  onChange={handleInputChange}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">전화번호</label>
              <input
                type="tel"
                name="phone"
                label="전화번호"
                placeholder="010-1234-5678"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">업체명</label>
              <input
                type="text"
                name="company"
                label="업체명"
                placeholder="협력 업체명"
                value={formData.company}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* 사진 첨부 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 mb-4">
            사진 첨부 <span className="text-red-500">*</span>
          </h3>
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="file"
                id="photoInputSelect"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
                ref={photoSelectInputRef}
                multiple
              />
              <Button
                type="button"
                onClick={handleFileSelectClick}
                variant="primary"
                className="w-full sm:w-auto"
              >
                <Upload className="w-5 h-5" />
                파일 선택
              </Button>
              <input
                type="file"
                id="photoInputCapture"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
                ref={photoCaptureInputRef}
              />
              <Button
                type="button"
                onClick={handleCameraCaptureClick}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                <Camera className="w-5 h-5" />
                촬영
              </Button>
            </div>
          </div>
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photoPreviews.map((preview, index) => (
                <div key={`${photoFiles[index]?.name || 'photo'}-${index}`} className="relative flex flex-col">
                  <img
                    src={preview}
                    alt={`미리보기 ${index + 1}`}
                    className="h-48 object-cover rounded-xl border-2 border-gray-200 w-full"
                  />
                  <Button
                    variant='icon'
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white !rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  {photoFiles[index] && (
                    <p className="mt-2 text-sm text-gray-600 font-bold">
                      {photoFiles[index].name} ({(photoFiles[index].size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-gray-600 font-semibold">
            첨부됨: {photoFiles.length}/{MAX_PHOTO_COUNT}
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-gray-700 font-semibold">
            <p>
              💡 부품 또는 장비의 사진을 첨부해 주세요. (파일당 최대 5MB, 최대 {MAX_PHOTO_COUNT}장, JPG/PNG 형식, 자동 리사이즈)
            </p>
          </div>
        </div>

        {/* 신청자 비고 */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-xl font-black text-gray-800 mb-4">신청자 비고</h3>
          <textarea
            name="remarks"
            label="신청자 비고"
            rows={4}
            placeholder="추가로 전달할 내용이 있으면 입력하세요."
            value={formData.remarks}
            onChange={handleInputChange}
          />
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-center sm:justify-end gap-4">
          <Button
            type="button"
            onClick={goBack}
            variant='secondary'
            className="w-full sm:w-auto"
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            variant='primary'
            className="w-full sm:w-auto"
          >
            {submitting ? '신청 중...' : '신청하기'}
          </Button>
        </div>
      </form>

    </div>
  );
};

export default OrderingNewRequestPage;

