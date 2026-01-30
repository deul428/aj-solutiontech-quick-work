
import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = "처리 중입니다..." }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute top-0 left-0" />
        </div>
        <p className="text-lg font-bold text-gray-800 animate-pulse">{message}</p>
        <p className="text-sm text-gray-400">잠시만 기다려 주세요.</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
