import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CommandPalette, CommandItem } from './CommandPalette';
import {
  Cpu,
  LayoutDashboard,
  LogOut,
  FolderTree,
  ShieldCheck,
  UserCheck,
  Factory,
  Search,
  ChevronRight,
  PackageCheck,
  Truck,
  FileSpreadsheet,
  Workflow,
  Command,
  Menu,
  X,
  Zap,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Boxes,
  BarChart3,
  Users,
  History,
  Settings as SettingsIcon,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const AppLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  // Global Ctrl/Cmd+K opens the page-jump palette from anywhere in the app.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Mobile menu scroll lock and keyboard accessibility
  React.useEffect(() => {
    if (!mobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Business-Centric Navigation Groups
  const navigationGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Inventory Management',
      items: [
        { name: 'Components & Stock', href: '/components', icon: Cpu },
        { name: 'Stock Inward (GIN)', href: '/stock-inward', icon: PackageCheck },
      ],
    },
    {
      title: 'Manufacturing & Job Work',
      items: [
        { name: 'Vendors (Assemblers)', href: '/vendors', icon: Truck },
        { name: 'Circuit BOM Recipes', href: '/circuits', icon: FileSpreadsheet },
        { name: 'Jobs & Challans', href: '/jobs', icon: Workflow },
        { name: 'Finished Goods', href: '/finished-goods', icon: Boxes },
      ],
    },
    {
      title: 'Intelligence & Reports',
      items: [
        { name: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Master Data', href: '/masters', icon: FolderTree },
        ...(isAdmin ? [{ name: 'Users & Roles', href: '/users', icon: Users }] : []),
        ...(isAdmin ? [{ name: 'Activity Log', href: '/activity-logs', icon: History }] : []),
        ...(isAdmin ? [{ name: 'Settings', href: '/settings', icon: SettingsIcon }] : []),
      ],
    },
  ];

  const commandItems: CommandItem[] = navigationGroups.flatMap((group) =>
    group.items
      .filter((item) => !item.disabled)
      .map((item) => ({ name: item.name, href: item.href, group: group.title, icon: item.icon }))
  );

  const userInitials =
    (user?.name || 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const getBreadcrumbs = () => {
    switch (location.pathname) {
      case '/':
        return ['Overview', 'Executive Dashboard'];
      case '/components':
        return ['Inventory Management', 'Components & Stock'];
      case '/stock-inward':
        return ['Inventory Management', 'Stock Inward (GIN)'];
      case '/vendors':
        return ['Manufacturing & Job Work', 'Vendors (Assemblers)'];
      case '/circuits':
        return ['Manufacturing & Job Work', 'Circuit BOM Recipes'];
      case '/jobs':
        return ['Manufacturing & Job Work', 'Jobs & Challans'];
      case '/finished-goods':
        return ['Manufacturing & Job Work', 'Finished Goods Inventory'];
      case '/reports':
        return ['Intelligence & Reports', 'Reports & Analytics'];
      case '/masters':
        return ['Administration', 'Master Data'];
      case '/users':
        return ['Administration', 'Users & Roles'];
      case '/activity-logs':
        return ['Administration', 'Activity Log'];
      case '/settings':
        return ['Administration', 'Settings'];
      default:
        return ['Workspace', 'Dashboard'];
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#807365]/20 text-[#A69B8D] border border-[#807365]/40 transition-colors">
            <ShieldCheck className="w-3 h-3 text-[#A69B8D]" />
            Admin
          </span>
        );
      case 'store_keeper':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#168060]/20 text-[#2db388] border border-[#168060]/40 transition-colors">
            <UserCheck className="w-3 h-3 text-[#2db388]" />
            Storekeeper
          </span>
        );
      case 'production':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#B7791F]/20 text-[#E09A38] border border-[#B7791F]/40 transition-colors">
            <Factory className="w-3 h-3 text-[#E09A38]" />
            Production
          </span>
        );
      default:
        return null;
    }
  };

  const breadcrumbs = getBreadcrumbs();

  const renderSidebarContent = (isCollapsed: boolean = false) => (
    <div className="flex flex-col h-full bg-[#141414] text-[#E8E6E2] select-none border-r border-[#252525] overflow-hidden">
      {/* Brand Header */}
      <div
        className={`h-14 ${
          isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
        } flex items-center border-b border-[#252525] transition-all duration-240 ease-smooth`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-[8px] bg-white text-[#141414] flex items-center justify-center shadow-xs shrink-0 transition-transform duration-180 ease-smooth hover:scale-105">
            <Zap className="w-4.5 h-4.5 fill-current text-[#141414]" />
          </div>
          {!isCollapsed && (
            <div className="truncate transition-opacity duration-200">
              <span className="text-[14px] font-semibold text-white tracking-tight leading-none block truncate">
                Wave Electronics
              </span>
              <p className="text-[11px] text-[#A69B8D] mt-0.5 leading-none truncate">
                Stock &amp; Job System
              </p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full bg-[#168060] shadow-[0_0_6px_#168060]"
              title="System Operational"
            />
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav
        className={`flex-1 ${
          isCollapsed ? 'px-2' : 'px-3'
        } py-3 space-y-4 overflow-y-auto overflow-x-hidden`}
      >
        {navigationGroups.map((group) => {
          const isGroupActive = group.items.some(
            (item) => location.pathname === item.href
          );
          const isGroupCollapsed =
            Boolean(collapsedGroups[group.title]) && !isGroupActive;

          return (
            <div key={group.title} className="space-y-1">
              {isCollapsed ? (
                <div className="h-[1px] bg-[#252525] my-2 mx-1" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#A69B8D] hover:text-white transition-colors duration-180 rounded-[6px] group"
                >
                  <span className="truncate">{group.title}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#807365] group-hover:text-[#A69B8D] transition-transform duration-200 ease-smooth ${
                      isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </button>
              )}

              {/* Smooth Collapsible Submenu Container */}
              <div
                className={
                  isCollapsed
                    ? 'space-y-1'
                    : `grid transition-[grid-template-rows,opacity] duration-200 ease-smooth ${
                        isGroupCollapsed
                          ? 'grid-rows-[0fr] opacity-0 pointer-events-none'
                          : 'grid-rows-[1fr] opacity-100'
                      }`
                }
              >
                <div className={isCollapsed ? 'space-y-1' : 'overflow-hidden space-y-0.5'}>
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    if (item.disabled) {
                      return (
                        <div
                          key={item.name}
                          title={item.name}
                          className={`flex items-center ${
                            isCollapsed
                              ? 'justify-center w-10 h-10 mx-auto'
                              : 'justify-between px-3 py-2'
                          } rounded-[8px] text-[13px] font-medium text-[#6B6863] opacity-60 cursor-not-allowed`}
                        >
                          <Icon className="w-4 h-4 text-[#6B6863] shrink-0" />
                          {!isCollapsed && <span>{item.name}</span>}
                        </div>
                      );
                    }

                    if (isCollapsed) {
                      return (
                        <div key={item.name} className="relative group/nav flex justify-center py-0.5">
                          <Link
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`w-10 h-10 flex items-center justify-center rounded-[8px] text-[13px] font-medium transition-all duration-180 ease-smooth relative ${
                              isActive
                                ? 'bg-[#1F1E1D] text-white border border-[#A69B8D]/40 shadow-xs'
                                : 'text-[#E8E6E2] hover:text-white hover:bg-[#1C1C1C]'
                            }`}
                            aria-label={item.name}
                          >
                            {isActive && (
                              <span
                                className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-[#A69B8D] shadow-[0_0_6px_rgba(166,155,141,0.6)]"
                                aria-hidden="true"
                              />
                            )}
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors duration-180 ease-smooth ${
                                isActive
                                  ? 'text-[#A69B8D]'
                                  : 'text-[#807365] group-hover/nav:text-[#A69B8D]'
                              }`}
                            />
                          </Link>
                          {/* Floating Hover Tooltip */}
                          <div className="sidebar-tooltip opacity-0 group-hover/nav:opacity-100 flex items-center gap-1.5 shadow-xl">
                            <span>{item.name}</span>
                            {item.badge && (
                              <span className="text-[10px] text-[#A69B8D] font-mono">
                                ({item.badge})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-[8px] text-[13px] font-medium transition-all duration-180 ease-smooth active:scale-[0.99] ${
                          isActive
                            ? 'bg-[#1F1E1D] text-white border border-[#807365]/35 shadow-xs pl-4'
                            : 'text-[#E8E6E2] hover:text-white hover:bg-[#1C1C1C]'
                        }`}
                      >
                        {/* Animated Active Golden-Grey Indicator Pill */}
                        {isActive && (
                          <span
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-4.5 rounded-full bg-[#A69B8D] shadow-[0_0_8px_rgba(166,155,141,0.6)]"
                            aria-hidden="true"
                          />
                        )}
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors duration-180 ease-smooth ${
                              isActive
                                ? 'text-[#A69B8D]'
                                : 'text-[#807365] group-hover:text-[#A69B8D]'
                            }`}
                          />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#1C1C1C] text-[#A69B8D] border border-[#282725]">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Account / Footer */}
      <div
        className={`p-3 border-t border-[#252525] bg-[#111111] ${
          isCollapsed ? 'flex flex-col items-center gap-2' : ''
        }`}
      >
        <div
          className={`flex items-center ${
            isCollapsed ? 'flex-col gap-2' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-[8px] bg-[#222222] border border-[#303030] flex items-center justify-center font-semibold text-xs text-[#E8E6E2] shrink-0 transition-transform duration-180 hover:scale-105">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!isCollapsed && (
              <div className="truncate transition-opacity duration-200">
                <p className="text-[13px] font-medium text-white truncate leading-tight">
                  {user?.name}
                </p>
                <div className="mt-0.5">{getRoleBadge(user?.role)}</div>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-[8px] text-[#A69B8D] hover:text-white hover:bg-[#1C1C1C] transition-all duration-180 ease-smooth active:scale-95"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F7F6F3] text-[#171717] overflow-hidden font-sans">
      {/* Desktop Sidebar with fluid collapse transition */}
      <aside
        className={`no-print hidden lg:flex flex-col z-20 flex-shrink-0 transition-all duration-240 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderSidebarContent(collapsed)}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/60 modal-backdrop-animate backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(false)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <header className="no-print h-14 bg-white border-b border-[#E6E3DE] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 z-10 flex-shrink-0">
          {/* Left: Mobile hamburger / Desktop collapse toggle & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-[8px] text-[#6B6863] hover:text-[#171717] hover:bg-[#F7F6F3] transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Desktop sidebar toggle button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex p-1.5 rounded-[8px] text-[#6B6863] hover:text-[#171717] hover:bg-[#F7F6F3] transition-colors duration-180 ease-smooth active:scale-95"
              aria-label="Toggle Sidebar"
            >
              {collapsed ? <PanelLeft className="w-4 h-4 text-[#807365]" /> : <PanelLeftClose className="w-4 h-4 text-[#807365]" />}
            </button>

            <nav className="flex items-center gap-2 text-[13px] min-w-0" aria-label="Breadcrumb">
              <span className="hidden sm:inline font-normal text-[#6B6863] truncate">{breadcrumbs[0]}</span>
              <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-[#A69B8D] shrink-0" />
              <span className="font-semibold sm:font-medium text-[#171717] tracking-tight truncate">{breadcrumbs[1]}</span>
            </nav>
          </div>

          {/* Right: page-jump palette trigger & account menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden lg:flex items-center gap-2 h-9 pl-3 pr-1.5 w-60 rounded-[10px] bg-[#FAF9F7] border border-[#E6E3DE] text-[#8A847C] hover:border-[#D8D4CE] hover:bg-white transition-all duration-180 ease-smooth"
              aria-label="Search pages"
            >
              <Search className="w-3.5 h-3.5 text-[#807365]" />
              <span className="flex-1 text-left text-[13px]">Search pages...</span>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[6px] bg-white border border-[#E6E3DE] text-[10px] font-mono text-[#807365]">
                {isMac ? <Command className="w-2.5 h-2.5" /> : 'Ctrl'} K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="lg:hidden p-2 rounded-[9px] text-[#6B6863] hover:text-[#171717] hover:bg-[#F7F6F3] transition-colors"
              aria-label="Search pages"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            <div className="h-5 w-px bg-[#E6E3DE] hidden lg:block" />

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 h-9 pl-1 pr-1 sm:pr-2.5 rounded-[10px] hover:bg-[#F7F6F3] transition-colors duration-180"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <span className="w-7 h-7 rounded-[8px] bg-[#141414] text-[#D9D2C7] flex items-center justify-center text-[11px] font-semibold tracking-wide">
                  {userInitials}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-[12.5px] font-medium text-[#171717] max-w-[140px] truncate">{user?.name}</span>
                  <span className="block text-[11px] text-[#8A847C] capitalize">{user?.role?.replace('_', ' ')}</span>
                </span>
                <ChevronDown
                  className={`hidden sm:block w-3.5 h-3.5 text-[#A69B8D] transition-transform duration-180 ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-[#E7E4DE] shadow-[0_16px_40px_-12px_rgba(23,23,23,0.22)] overflow-hidden z-50 modal-dialog-animate"
                >
                  <div className="px-4 py-3.5 border-b border-[#EFECE7]">
                    <p className="text-[13px] font-semibold text-[#171717] truncate">{user?.name}</p>
                    <p className="text-[12px] text-[#8A847C] truncate">{user?.email}</p>
                    <div className="mt-2 [&_span]:!bg-[#FAF9F7] [&_span]:!text-[#716B64] [&_span]:!border-[#E7E4DE] [&_svg]:!text-[#807365]">
                      {getRoleBadge(user?.role)}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[13px] text-[#C2413A] hover:bg-[#C2413A]/[0.06] transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace canvas; the inner column is min-h-full so the footer sits at the bottom of short pages. */}
        <main className="flex-1 overflow-y-auto bg-[#F7F6F3] min-w-0">
          <div className="min-h-full flex flex-col p-4 sm:p-6 lg:p-8">
            <div key={location.pathname} className="page-transition-enter w-full min-w-0 flex-1">
              <Outlet />
            </div>

            <footer className="no-print mt-10 pt-4 border-t border-[#E6E3DE] flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[12px] text-[#8A847C]">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[#A69B8D]" />
                © {new Date().getFullYear()} Wave Electronics · Component Stock &amp; Job Management
              </span>
              <span className="hidden md:inline">
                Press{' '}
                <kbd className="px-1 py-px rounded-[4px] bg-white border border-[#E6E3DE] font-mono text-[10px] text-[#807365]">
                  {isMac ? '⌘' : 'Ctrl'}+K
                </kbd>{' '}
                to jump to any page
              </span>
            </footer>
          </div>
        </main>
      </div>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} items={commandItems} />
    </div>
  );
};
