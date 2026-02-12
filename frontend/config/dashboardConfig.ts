import {
    ClipboardCheck,
    FileText,
    RefreshCcw,
    Package,
    Users,
    MapPin,
    ScanQrCode,
    Home as HomeIcon,
    User as UserIcon,
    Key,
    ArrowRight
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

/**
 * 대시보드 메뉴 아이템 인터페이스
 */
export interface DashboardMenuItem {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
    path: string;
    color: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'red' | 'yellow' | 'pink';
    // 표시 조건: 'console' | 'user' | 'all'
    roles?: readonly ('console' | 'user' | 'all')[];
    // 숨김 여부
    hidden?: boolean;
    // 비활성화 여부 (true면 메뉴는 보이지만 클릭 불가)
    disabled?: boolean;
    // 대시보드 표시 여부: 'all' | 'user-only' | 'console-only'
    // 'all': 모든 대시보드에 표시 (기본값)
    // 'user-only': user 대시보드에만 표시 (console 대시보드에는 숨김, 하지만 접근은 가능)
    // 'console-only': console 대시보드에만 표시
    dashboardVisibility?: 'all' | 'user-only' | 'console-only';
    // Navbar에 표시할지 여부 (true면 navbar에 표시, false면 표시 안 함)
    navbar?: boolean;
    // Navbar에서 사용할 라벨 (없으면 title 사용)
    navbarLabel?: string;
    // Navbar에서 활성화 조건 (path가 이 값으로 시작하면 활성화)
    navbarActivePath?: string;
    // Navbar에서 표시 순서 (숫자가 작을수록 앞에 표시, 기본값: 999)
    navbarOrder?: number;
}

/**
 * 대시보드 섹션 인터페이스
 */
export interface DashboardSection {
    id: string;
    title: string;
    titleColor: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'red' | 'yellow' | 'pink';
    gridCols?: '1' | '2' | '3'; // 그리드 컬럼 수 (기본값: '3')
    menus: DashboardMenuItem[];
}

/**
 * 색상 클래스 매핑
 */
export const colorClasses = {
    blue: {
        bg: 'bg-blue-100',
        hover: 'group-hover:bg-blue-600',
        text: 'text-blue-600',
        shadow: 'hover:shadow-blue-100',
        accent: 'bg-blue-50',
        titleBar: 'bg-blue-600'
    },
    green: {
        bg: 'bg-green-100',
        hover: 'group-hover:bg-green-600',
        text: 'text-green-600',
        shadow: 'hover:shadow-green-100',
        accent: 'bg-green-50',
        titleBar: 'bg-green-600'
    },
    purple: {
        bg: 'bg-purple-100',
        hover: 'group-hover:bg-purple-600',
        text: 'text-purple-600',
        shadow: 'hover:shadow-purple-100',
        accent: 'bg-purple-50',
        titleBar: 'bg-purple-600'
    },
    orange: {
        bg: 'bg-orange-100',
        hover: 'group-hover:bg-orange-600',
        text: 'text-orange-600',
        shadow: 'hover:shadow-orange-100',
        accent: 'bg-orange-50',
        titleBar: 'bg-orange-600'
    },
    indigo: {
        bg: 'bg-indigo-100',
        hover: 'group-hover:bg-indigo-600',
        text: 'text-indigo-600',
        shadow: 'hover:shadow-indigo-100',
        accent: 'bg-indigo-50',
        titleBar: 'bg-indigo-600'
    },
    red: {
        bg: 'bg-red-100',
        hover: 'group-hover:bg-red-600',
        text: 'text-red-600',
        shadow: 'hover:shadow-red-100',
        accent: 'bg-red-50',
        titleBar: 'bg-red-600'
    },
    yellow: {
        bg: 'bg-yellow-100',
        hover: 'group-hover:bg-yellow-600',
        text: 'text-yellow-600',
        shadow: 'hover:shadow-yellow-100',
        accent: 'bg-yellow-50',
        titleBar: 'bg-yellow-600'
    },
    pink: {
        bg: 'bg-pink-100',
        hover: 'group-hover:bg-pink-600',
        text: 'text-pink-600',
        shadow: 'hover:shadow-pink-100',
        accent: 'bg-pink-50',
        titleBar: 'bg-pink-600'
    }
};

/**
 * 관리자 대시보드 설정
 * 
 * 메뉴를 추가/제거하려면 이 배열을 수정하세요.
 */
export const adminDashboardSections: DashboardSection[] = [
    {
        id: 'equipment',
        title: '장비 점검, 실사, QR생성',
        titleColor: 'blue',
        gridCols: '3',
        menus: [
            {
                id: 'equiment-main',
                title: '장비 점검, 실사, QR생성',
                description: '장비 점검, 실사, QR생성',
                icon: ClipboardCheck,
                path: '/equipment',
                color: 'blue',
                roles: ['console'],
                navbar: true,
                navbarLabel: '장비 점검, 실사, QR생성',
                navbarOrder: 1
            },
            /* 
            // 예시: disabled 속성 사용
            {
                id: 'checklist',
                title: '체크리스트 생성',
                description: '자산 점검용 체크리스트 생성',
                icon: ClipboardCheck,
                path: '/equipment/checklist',
                color: 'blue',
                roles: ['console'],
                disabled: true, // 비활성화 (메뉴는 보이지만 클릭 불가)
                navbar: false,
                navbarLabel: '체크리스트 생성',
                navbarOrder: 2
            },
            // 예시: dashboardVisibility 사용
            {
                id: 'audit-history',
                title: '자산 실사 내역 확인',
                description: '체크리스트 데이터 조회 및 관리',
                icon: FileText,
                path: '/equipment/audit-history',
                color: 'pink',
                roles: ['console'],
                dashboardVisibility: 'console-only', // console 대시보드에만 표시
                navbar: false,
                navbarOrder: 3
            },
            {
                id: 'master-file',
                title: '마스터 파일 관리',
                description: 'SAP 자산정보 파일 갱신 및 관리',
                icon: RefreshCcw,
                path: '/equipment/master',
                color: 'purple',
                roles: ['console'],
                navbar: false
            }
            */
        ]
    },
    {
        id: 'ordering',
        title: '부품 발주',
        titleColor: 'green',
        gridCols: '3',
        menus: [
            {
                id: 'ordering-main',
                title: '부품 발주',
                description: '새 부품 신청, 내 부품 신청 내역 확인, 관리자 부품 신청 현황 조회',
                icon: Package,
                path: '/ordering',
                color: 'green',
                roles: ['console',/*  'user' */], // console과 user 모두 접근 가능
                dashboardVisibility: 'all', // 모든 대시보드에 표시
                navbar: true,
                navbarLabel: '부품 발주',
                navbarActivePath: '/ordering',
                navbarOrder: 20
            }
        ]
    },
    {
        id: 'master-data',
        title: '기준 정보 관리',
        titleColor: 'yellow',
        gridCols: '2',
        menus: [
            {
                id: 'users',
                title: '사용자 관리',
                description: '사용자 등록/수정/삭제',
                icon: Users,
                path: '/console/users',
                color: 'yellow',
                roles: ['console'],
                navbar: false // 대시보드에만 표시
            },
            {
                id: 'delivery-places',
                title: '부품 배송지 관리',
                description: '배송지 등록/수정/삭제',
                icon: MapPin,
                path: '/console/delivery-places',
                color: 'red',
                roles: ['console'],
                navbar: false // 대시보드에만 표시
            }
        ]
    }
];

/**
 * 시스템 홈 페이지 설정
 * 
 * 시스템 선택 카드를 추가/제거하려면 이 배열을 수정하세요.
 */
export interface SystemHomeCard {
    id: string;
    title: string;
    description: string | ((isAdmin: boolean) => string);
    icon: LucideIcon;
    iconBgColor: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'red' | 'yellow' | 'pink';
    // 클릭 시 이동할 경로 또는 함수
    navigateTo: string | ((isAdmin: boolean, isUser: boolean) => string);
    // 표시 조건: 'console' | 'user' | 'all'
    roles?: readonly ('console' | 'user' | 'all')[];
    // 숨김 여부
    hidden?: boolean;
}

/**
 * 사용자 대시보드 설정
 * 
 * 메뉴를 추가/제거하려면 이 배열을 수정하세요.
 */
import { getCurrentUser } from '../utils/orderingAuth';
const currentUser = getCurrentUser();
export const userDashboardSections: DashboardSection[] = [
    {
        id: 'equipment',
        title: '장비 점검, 실사, QR생성',
        titleColor: 'blue',
        gridCols: '2',
        menus: [
            {
                id: 'audit',
                title: '자산 실사',
                description: 'QR코드로 빠르게 자산 실사를 수행',
                icon: ScanQrCode,
                path: '/equipment/audit',
                color: 'blue',
                roles: ['user'], // console도 접근 가능 (navbar나 직접 URL로)
                dashboardVisibility: 'user-only', // user 대시보드에만 표시
                navbar: true,
                navbarLabel: '자산 실사',
                navbarOrder: 10
            }
        ]
    },
    {
        id: 'ordering',
        title: '부품 발주',
        titleColor: 'green',
        gridCols: '2',
        menus: [
            {
                id: 'ordering-main',
                title: '부품 발주',
                description: '새 부품 신청, 내 부품 신청 내역 확인',
                icon: Package,
                path: '/ordering',
                color: 'green',
                roles: ['user'], // console도 접근 가능 (navbar나 직접 URL로)
                dashboardVisibility: 'user-only', // user 대시보드에만 표시
                navbar: true,
                navbarLabel: '부품 발주',
                navbarActivePath: '/ordering',
                navbarOrder: 20
            }
        ]
    }
];

/**
 * 시스템 홈 페이지 설정 (레거시 - /user로 이동됨)
 * 
 * 시스템 선택 카드를 추가/제거하려면 이 배열을 수정하세요.
 */
/**
 * Navbar 전용 메뉴 아이템 인터페이스 (대시보드에 없는 특수 메뉴)
 */
export interface NavbarOnlyMenuItem {
    id: string;
    label: string;
    path: string;
    icon: LucideIcon;
    roles?: readonly ('console' | 'user' | 'all' | 'guest')[];
    activePath?: string;
    isLogout?: boolean;
    isLogin?: boolean;
    hidden?: boolean;
    // Navbar에서 표시 순서 (숫자가 작을수록 앞에 표시, 기본값: 999)
    navbarOrder?: number;
}

/**
 * Navbar 전용 메뉴 (대시보드에 없는 특수 메뉴)
 */
export const navbarOnlyMenuItems: NavbarOnlyMenuItem[] = [
    // 홈
    {
        id: 'home',
        label: '홈',
        path: '/',
        icon: HomeIcon,
        roles: ['guest'],
        navbarOrder: 1
    },
    // 대시보드 홈
    {
        id: 'admin-home',
        label: '관리자 홈',
        path: '/console',
        icon: HomeIcon,
        roles: ['console'],
        navbarOrder: 1
    },
    {
        id: 'user-home',
        label: '사용자 홈',
        path: '/user',
        icon: HomeIcon,
        roles: ['user'],
        navbarOrder: 1
    },
    // 공통 메뉴
    {
        id: 'info',
        label: currentUser ? `${currentUser?.name} (${currentUser?.team})` : '내 정보',
        path: '/info',
        icon: UserIcon,
        roles: ['all'],
        navbarOrder: 90
    },
    // 로그인/로그아웃
    {
        id: 'login',
        label: '로그인',
        path: '/login',
        icon: Key,
        roles: ['guest'],
        isLogin: true,
        navbarOrder: 100
    },
    {
        id: 'logout',
        label: '로그아웃',
        path: '#',
        icon: Key,
        roles: ['all'],
        isLogout: true,
        navbarOrder: 100
    }
];

/**
 * 대시보드 메뉴에서 Navbar 메뉴 아이템 생성
 */
export interface NavbarMenuItem {
    id: string;
    label: string;
    path: string;
    icon: LucideIcon;
    roles?: readonly ('console' | 'user' | 'all' | 'guest')[];
    activePath?: string;
    isLogout?: boolean;
    isLogin?: boolean;
    hidden?: boolean;
    // Navbar에서 표시 순서 (숫자가 작을수록 앞에 표시, 기본값: 999)
    navbarOrder?: number;
}

/**
 * 모든 대시보드 섹션에서 navbar: true인 메뉴를 추출하여 Navbar 메뉴 아이템으로 변환
 */
export function getNavbarMenuItemsFromDashboards(): NavbarMenuItem[] {
    const items: NavbarMenuItem[] = [];

    // 관리자 대시보드 메뉴에서 추출
    adminDashboardSections.forEach(section => {
        section.menus.forEach(menu => {
            if (menu.navbar && !menu.hidden) {
                items.push({
                    id: menu.id,
                    label: menu.navbarLabel || menu.title,
                    path: menu.path,
                    icon: menu.icon,
                    roles: menu.roles,
                    activePath: menu.navbarActivePath,
                    navbarOrder: menu.navbarOrder
                });
            }
        });
    });

    // 사용자 대시보드 메뉴에서 추출
    userDashboardSections.forEach(section => {
        section.menus.forEach(menu => {
            if (menu.navbar && !menu.hidden) {
                items.push({
                    id: menu.id,
                    label: menu.navbarLabel || menu.title,
                    path: menu.path,
                    icon: menu.icon,
                    roles: menu.roles,
                    activePath: menu.navbarActivePath,
                    navbarOrder: menu.navbarOrder
                });
            }
        });
    });

    return items;
}

/**
 * Navbar 메뉴 아이템 통합 (대시보드 메뉴 + 전용 메뉴)
 * navbarOrder로 정렬 (숫자가 작을수록 앞에 표시)
 */
export const navbarMenuItems: NavbarMenuItem[] = [
    ...navbarOnlyMenuItems,
    ...getNavbarMenuItemsFromDashboards()
].sort((a, b) => {
    const orderA = a.navbarOrder ?? 999;
    const orderB = b.navbarOrder ?? 999;
    return orderA - orderB;
});

export const systemHomeCards: SystemHomeCard[] = [
    {
        id: 'equipment',
        title: '장비 점검 · 실사 · QR생성',
        description: (isAdmin: boolean) =>
            isAdmin
                ? 'QR코드가 포함된 정비 체크리스트 자동 생성, 자산 실사 내역 확인'
                : 'QR코드로 빠르게 자산 실사를 수행',
        icon: ClipboardCheck,
        iconBgColor: 'blue',
        navigateTo: (isAdmin: boolean, isUser: boolean) => {
            if (isAdmin) return '/equipment';
            if (isUser) return '/equipment';
            return '/login';
        },
        roles: ['console', 'user']
    },
    {
        id: 'ordering',
        title: '부품 발주',
        description: (isAdmin: boolean) =>
            isAdmin
                ? '부품 신청 내역 확인, 상태 변경, 기준 정보 관리'
                : '새 부품 신청, 내 부품 신청 내역 확인',
        icon: Package,
        iconBgColor: 'green',
        navigateTo: (isAdmin: boolean, isUser: boolean) => {
            if (isAdmin) return '/console';
            if (isUser) return '/ordering';
            return '/login';
        },
        roles: ['console', 'user']
    }
];

