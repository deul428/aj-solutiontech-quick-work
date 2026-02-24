import {
    ClipboardCheck,
    Package,
    Users,
    MapPin,
    Home as HomeIcon,
    User as UserIcon,
    Key
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import type { User } from '../types/ordering';

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
    // 표시 조건: 'manager' | 'user'
    roles?: readonly ('manager' | 'user')[];
    /**
     * 시스템별 권한이 필요한 메뉴(주로 관리자 메뉴)용
     * - ordering: 부품발주 관리자(orderingRole)
     * - equipment: 정비/실사 관리자(auditRole)
     */
    requiredSystem?: 'ordering' | 'equipment';
    /**
     * disabled 여부를 런타임 컨텍스트로 결정하고 싶을 때 사용합니다.
     * - 대시보드 통합 시, 메뉴는 항상 노출하되 권한/정책에 따라 클릭만 막는 용도
     */
    disabledWhen?: (ctx: DashboardMenuAccessContext) => boolean;
    // 숨김 여부
    hidden?: boolean;
    // 비활성화 여부 (true면 메뉴는 보이지만 클릭 불가)
    disabled?: boolean;
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
    gridCols?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'; // 그리드 컬럼 수 (기본값: '3')
    menus: DashboardMenuItem[];
}

/**
 * 대시보드 메뉴 접근/표시 컨텍스트
 * - DashboardPage에서 생성하여 disabledWhen에 전달합니다.
 */
export interface DashboardMenuAccessContext {
    user: User | null;
    uiRole: 'manager' | 'user';
    isOrderingAdmin: boolean;
    isAuditAdmin: boolean;
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
 * 통합 대시보드(로그인 사용자 공통)
 *
 * - 관리자/사용자 대시보드를 분리하지 않고, 메뉴를 한 곳에 모읍니다.
 * - '사용자 관리', '부품 배송지 관리'는 disabledWhen 정책으로 enable/disable을 쉽게 조정할 수 있습니다.
 */
export const unifiedDashboardMenuPolicy = {
    /**
     * 사용자 관리 메뉴 enable 조건
     * - 기본값: ordering 관리자만 활성화
     * - 필요 시 이 함수만 바꿔서 enable/disable 정책을 바꿀 수 있습니다.
     */
    canManageUsers: (ctx: DashboardMenuAccessContext) => ctx.isOrderingAdmin,
    /**
     * 배송지 관리 메뉴 enable 조건
     * - 기본값: ordering 관리자만 활성화
     */
    canManageDeliveryPlaces: (ctx: DashboardMenuAccessContext) => ctx.isOrderingAdmin,
};

export const unifiedDashboardSections: DashboardSection[] = [
    {
        id: 'unified',
        title: '대시보드',
        titleColor: 'blue',
        gridCols: '4',
        menus: [
            {
                id: 'ordering-main',
                title: '부품 발주',
                description: '새 부품 신청, 내 신청 내역 확인',
                icon: Package,
                path: '/ordering',
                color: 'green',
                roles: ['manager', 'user'],
                navbar: true,
                navbarLabel: '부품 발주',
                navbarActivePath: '/ordering',
                navbarOrder: 20
            },
            {
                id: 'equiment-main',
                title: '장비 점검, 실사, QR생성',
                description: '장비 점검, 실사, QR생성',
                icon: ClipboardCheck,
                path: '/equipment',
                color: 'blue',
                roles: ['manager', 'user'],
                navbar: true,
                navbarLabel: '장비 점검, 실사, QR생성',
                navbarActivePath: '/equipment',
                navbarOrder: 10
            },
            {
                id: 'users',
                title: '사용자 관리',
                description: '사용자 등록/수정/삭제',
                icon: Users,
                path: '/manager/users',
                color: 'yellow',
                roles: ['manager', 'user'],
                navbar: false,
                disabledWhen: (ctx) => !unifiedDashboardMenuPolicy.canManageUsers(ctx),
            },
            {
                id: 'delivery-places',
                title: '부품 배송지 관리',
                description: '배송지 등록/수정/삭제',
                icon: MapPin,
                path: '/manager/delivery-places',
                color: 'red',
                roles: ['manager', 'user'],
                navbar: false,
                disabledWhen: (ctx) =>
                    !unifiedDashboardMenuPolicy.canManageDeliveryPlaces(ctx),
            },
        ]
    }
];

/**
 * 관리자 대시보드 설정
 * 
 * 메뉴를 추가/제거하려면 이 배열을 수정하세요.
 */
export const adminDashboardSections: DashboardSection[] = [
    ...unifiedDashboardSections
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
    // 표시 조건: 'manager' | 'user'
    roles?: readonly ('manager' | 'user')[];
    // 숨김 여부
    hidden?: boolean;
}

/**
 * 사용자 대시보드 설정
 * 
 * 메뉴를 추가/제거하려면 이 배열을 수정하세요.
 */
export const userDashboardSections: DashboardSection[] = [
    ...unifiedDashboardSections
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
    roles?: readonly ('manager' | 'user' | 'guest')[];
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
    // 대시보드 홈 (통합)
    {
        id: 'dashboard-home',
        label: '대시보드',
        path: '/dashboard',
        icon: HomeIcon,
        roles: ['manager', 'user'],
        navbarOrder: 1
    },
    // 공통 메뉴
    {
        id: 'info',
        label: '내 정보',
        path: '/info',
        icon: UserIcon,
        roles: ['manager', 'user'],
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
        roles: ['manager', 'user'],
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
    roles?: readonly ('manager' | 'user' | 'guest')[];
    requiredSystem?: 'ordering' | 'equipment';
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
    const byId = new Map<string, NavbarMenuItem>();

    // 관리자 대시보드 메뉴에서 추출
    adminDashboardSections.forEach(section => {
        section.menus.forEach(menu => {
            if (menu.navbar && !menu.hidden) {
                const item: NavbarMenuItem = {
                    id: menu.id,
                    label: menu.navbarLabel || menu.title,
                    path: menu.path,
                    icon: menu.icon,
                    roles: menu.roles,
                    requiredSystem: menu.requiredSystem,
                    activePath: menu.navbarActivePath,
                    navbarOrder: menu.navbarOrder
                };
                const existing = byId.get(item.id);
                if (!existing) {
                    byId.set(item.id, item);
                } else {
                    // roles는 합집합(중복 제거)으로 병합
                    const mergedRoles = Array.from(
                        new Set([...(existing.roles || []), ...(item.roles || [])])
                    ) as NavbarMenuItem['roles'];
                    const merged: NavbarMenuItem = { ...existing, roles: mergedRoles };

                    const prevOrder = existing.navbarOrder ?? 999;
                    const nextOrder = item.navbarOrder ?? 999;
                    if (nextOrder < prevOrder) {
                        byId.set(item.id, { ...item, roles: mergedRoles });
                    } else {
                        byId.set(item.id, merged);
                    }
                }
            }
        });
    });

    // 사용자 대시보드 메뉴에서 추출
    userDashboardSections.forEach(section => {
        section.menus.forEach(menu => {
            if (menu.navbar && !menu.hidden) {
                const item: NavbarMenuItem = {
                    id: menu.id,
                    label: menu.navbarLabel || menu.title,
                    path: menu.path,
                    icon: menu.icon,
                    roles: menu.roles,
                    requiredSystem: menu.requiredSystem,
                    activePath: menu.navbarActivePath,
                    navbarOrder: menu.navbarOrder
                };
                const existing = byId.get(item.id);
                if (!existing) {
                    byId.set(item.id, item);
                } else {
                    const mergedRoles = Array.from(
                        new Set([...(existing.roles || []), ...(item.roles || [])])
                    ) as NavbarMenuItem['roles'];
                    const merged: NavbarMenuItem = { ...existing, roles: mergedRoles };

                    const prevOrder = existing.navbarOrder ?? 999;
                    const nextOrder = item.navbarOrder ?? 999;
                    if (nextOrder < prevOrder) {
                        byId.set(item.id, { ...item, roles: mergedRoles });
                    } else {
                        byId.set(item.id, merged);
                    }
                }
            }
        });
    });

    return Array.from(byId.values());
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
        roles: ['manager', 'user']
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
            if (isAdmin) return '/ordering';
            if (isUser) return '/ordering';
            return '/login';
        },
        roles: ['manager', 'user']
    }
];

