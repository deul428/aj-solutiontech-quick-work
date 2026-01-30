
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ChecklistData } from "../types";

interface ChecklistPreviewProps {
  data: ChecklistData;
  engineerInput: string;
}

const ChecklistPreview: React.FC<ChecklistPreviewProps> = ({
  data,
  engineerInput,
}) => {
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    if (data.mgmtNumber) {
      QRCode.toDataURL(data.mgmtNumber, { margin: 1, width: 300 })
        .then((url) => setQrUrl(url))
        .catch((err) => console.error("QR Generate Error:", err));
    }
  }, [data.mgmtNumber]);

  const today = new Date();
  const yyyy = `${today.getFullYear().toString()}`;

  // Helper component for cell content to ensure vertical centering in PDF
  // Fix: Make children optional to avoid TS error on empty cells
  const CellContent = ({ children, align = "center" }: { children?: React.ReactNode, align?: "center" | "left" }) => (
    <div className={`flex items-center ${align === "left" ? "justify-start px-3" : "justify-center px-1"} h-full leading-none w-full`}>
      {children}
    </div>
  );

  return (
    <div className="checklist-preview-item bg-white p-6 border border-gray-100 w-[210mm] mx-auto my-4 font-sans text-black overflow-hidden box-border shadow-sm">
      {/* Header Area */}
      <div className="flex justify-between items-end mb-1 px-1">
        <h2 className="text-[28px] font-bold leading-none tracking-tight">
          상품/임가/경,중 체크리스트
        </h2>
        {qrUrl ? (
          <div className="flex flex-col items-center gap-1">
            <div className="text-right mb-1">
              <span className="text-md font-bold">
                관리번호:
                <span className="text-xl font-bold"> {data.mgmtNumber}</span>
              </span>
            </div>
          </div>
          ) : null}
      </div>

      <div className="flex justify-between items-center mb-4 px-1">
        <div className="grid grid-cols-4 gap-x-12 gap-y-2 flex-1">
          <div className="flex items-center gap-2 border-black pb-1 h-14">
            <span className="text-md font-bold whitespace-nowrap">정비 일자:</span>
            <div className="flex-1 text-md">{yyyy}.</div>
          </div>
          <div className="flex items-center gap-2 border-black pb-1 h-14">
            <span className="text-md font-bold whitespace-nowrap">정비자: {engineerInput}</span>
            <div className="flex-1"></div>
          </div>
          <div className="flex items-center gap-2 border-black pb-1 h-14">
            <span className="text-md font-bold whitespace-nowrap">QC 일자:</span>
            <div className="flex-1 text-md">{yyyy}.</div>
          </div>
          <div className="flex items-center gap-2 border-black pb-1 h-14">
            <span className="text-md font-bold whitespace-nowrap">QC:</span>
            <div className="flex-1"></div>
          </div>
        </div>

        <div className="ml-8 p-1 bg-white flex items-center justify-center">
              <img src={qrUrl} alt="QR" className="w-24 h-24 block" /></div>
           
      </div>

      {/* Main Table: Precise 8-column layout (8.33% each) */}
      <div className="w-full mb-4">
        <table className="w-full border-t-2 border-l-2 border-black text-[12px] table-fixed border-separate border-spacing-0">
          <colgroup>
            <col className="w-[8.33%]" />
            <col className="w-[16.66%]" />
            <col className="w-[8.33%]" />
            <col className="w-[16.66%]" />
            <col className="w-[8.33%]" />
            <col className="w-[16.66%]" />
            <col className="w-[8.33%]" />
            <col className="w-[16.66%]" />
          </colgroup>
          <tbody>
            {/* Row 6: Code(1) + Val(1) + NameLabel(1) + NameVal(5) = 8 */}
            <tr className="h-12">
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>상품코드</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 overflow-hidden align-middle">
                <CellContent>{data.productCode}</CellContent>
              </td>
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>상품명</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 align-middle" colSpan={5}>
                <CellContent align="left">{data.productName}</CellContent>
              </td>
            </tr>
            {/* Row 7: 1+1+1+1+1+1+1+1 = 8 */}
            <tr className="h-12">
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>제조사</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 overflow-hidden align-middle">
                <CellContent>{data.manufacturer}</CellContent>
              </td>
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>모델</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 overflow-hidden align-middle">
                <CellContent>{data.model}</CellContent>
              </td>
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>년식</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 align-middle">
                <CellContent>{data.year}</CellContent>
              </td>
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>사용시간</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 align-middle">
                <CellContent></CellContent>
              </td>
            </tr>
            {/* Row 8: Asset(1)+Val(1) + VehLabel(1)+Val(1) + SerialLabel(1)+Val(3) = 8 */}
            <tr className="h-12">
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>자산번호</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 overflow-hidden align-middle">
                <CellContent>{data.assetNumber}</CellContent>
              </td>
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>차량번호</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 overflow-hidden align-middle">
                <CellContent>{data.vehicleNumber}</CellContent>
              </td>
              <td className="bg-gray-100 font-bold border-r-2 border-b-2 border-black p-0 align-middle">
                <CellContent>차대번호</CellContent>
              </td>
              <td className="border-r-2 border-b-2 border-black font-bold p-0 align-middle" colSpan={3}>
                <CellContent align="left">{data.serialNumber}</CellContent>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center px-2 h-12">
        <div className="flex gap-10">
          <div className="flex items-end gap-2">
            <span className="font-bold text-lg">물류:</span>
            <span className={`w-12 h-8 border-black flex items-center justify-center text-2xl font-black ${data.category === "물류" ? "text-black" : "text-transparent"}`}>
              O
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">건설:</span>
            <span className={`w-12 h-8 border-black flex items-center justify-center text-2xl font-black ${data.category === "건설" ? "text-black" : "text-transparent"}`}>
              O
            </span>
          </div>
        </div>
        <div className="text-md font-bold">
          양호: V &nbsp; 보통: △ &nbsp; 불량: x &nbsp; 교체: O &nbsp; 해당없음: N
        </div>
      </div>
    </div>
  );
};

export default ChecklistPreview;
