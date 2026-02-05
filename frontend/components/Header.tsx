
import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
    headerTitle: string;
    headerSubTitle: string;
    level: number;
}
const Header: React.FC<HeaderProps> = ({ headerTitle, headerSubTitle, level }) => {
    const navigate = useNavigate();
    const goBack = () => {
        // 이전 페이지로 돌아가거나 홈으로 이동
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    return (
        level ? level === 1 ?
            <div className="text-center mb-8 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-extrabold text-red-500 mb-2 tracking-tight">{headerSubTitle}</h3>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">{headerTitle}</h2>
            </div> : level === 2 ?
                <div className="text-center mb-8 sm:mb-6 flex flex-row">
                    <button
                        onClick={goBack}
                        className="w-[10%] p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div className="w-[80%]">
                        <h3 className="text-xl sm:text-2xl font-extrabold text-red-500 mb-2 tracking-tight">{headerSubTitle}</h3>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">{headerTitle}</h2>
                    </div>
                    <div className="w-[10%]"></div>
                </div>
                : null
            : null
    )
};

export default Header;