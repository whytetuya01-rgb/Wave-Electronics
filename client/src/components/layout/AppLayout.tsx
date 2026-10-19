import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Master Data', href: '/masters', icon: FolderTree },
      ],
    },
  ];

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
      case '/masters':
        return ['Administration', 'Master Data'];
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
    <div className="flex flex-col h-full bg-[#141414] text-[#E8E6E2] select-none border-r border-[#252525]">
      {/* Brand Header */}
      <div className={`h-14 ${isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'} flex items-center border-b border-[#252525] transition-all duration-240 ease-smooth`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-[8px] bg-white text-[#141414] flex items-center justify-center shadow-xs shrink-0 transition-transform duration-180 ease-smooth hover:scale-105">
            <Zap className="w-4 h-4 fill-current text-[#141414]" />
          </div>
          {!isCollapsed && (
            <div className="truncate transition-opacity duration-200">
              <span className="text-[14px] font-semibold text-white tracking-tight leading-none block truncate">
                Wave Electronics
              </span>
              <p className="text-[11px] text-[#A69B8D] mt-0.5 leading-none truncate">Stock & Job System</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#168060] shadow-[0_0_6px_#168060]" title="System Operational" />
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-3'} py-4 space-y-5 overflow-y-auto overflow-x-hidden`}>
        {navigationGroups.map((group) => (
          <div key={group.title}>
            {isCollapsed ? (
              <div className="h-[1px] bg-[#252525] my-2 mx-1" />
            ) : (
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A69B8D] truncate">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <div
                      key={item.name}
                      title={item.name}
                      className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-2.5'} py-2 rounded-[8px] text-[13px] font-medium text-[#6B6863] opacity-60 cursor-not-allowed`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-[#6B6863] shrink-0" />
                        {!isCollapsed && <span>{item.name}</span>}
                      </div>
                      {!isCollapsed && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1C1C1C] text-[#807365] border border-[#282725]">
                          Planned
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    title={isCollapsed ? item.name : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-2.5'} py-2 rounded-[8px] text-[13px] font-medium transition-all duration-180 ease-smooth active:scale-[0.98] ${isActive
                        ? 'bg-[#1F1E1D] text-white border border-[#807365]/35 shadow-xs'
                        : 'text-[#E8E6E2] hover:text-white hover:bg-[#1C1C1C]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors duration-180 ease-smooth ${isActive ? 'text-[#A69B8D]' : 'text-[#807365] group-hover:text-[#A69B8D]'
                          }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#1C1C1C] text-[#A69B8D] border border-[#282725]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Account / Footer */}
      <div className={`p-3 border-t border-[#252525] bg-[#111111] ${isCollapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-[8px] bg-[#222222] border border-[#303030] flex items-center justify-center font-semibold text-xs text-[#E8E6E2] shrink-0 transition-transform duration-180 hover:scale-105">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!isCollapsed && (
              <div className="truncate transition-opacity duration-200">
                <p className="text-[13px] font-medium text-white truncate leading-tight">{user?.name}</p>
                <div className="mt-0.5">{getRoleBadge(user?.role)}</div>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-[8px] text-[#A69B8D] hover:text-white hover:bg-[#1C1C1C] transition-all duration-180 ease-smooth active:scale-95"
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
        className={`hidden lg:flex flex-col z-20 flex-shrink-0 transition-all duration-240 ease-smooth ${collapsed ? 'w-[68px]' : 'w-64'
          }`}
      >
        {renderSidebarContent(collapsed)}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 modal-backdrop-animate backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(false)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Pure White Top Header */}
        <header className="h-14 bg-white border-b border-[#
        
        
        
        
        
        
        
        
        
        
        
        
        E6E3DE] px-4 sm:px-6 lg:px-8 flex items-center justify-between z-10 flex-shrink-0">
          {/* Left: Mobile hamburger / Desktop collapse toggle & Breadcrumbs */}
          <div className="flex items-center gap-3">
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

            <nav className="flex items-center gap-2 text-[13px]" aria-label="Breadcrumb">
              <span className="font-normal text-[#6B6863]">{breadcrumbs[0]}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#A69B8D] shrink-0" />
              <span className="font-medium text-[#171717] tracking-tight">{breadcrumbs[1]}</span>
            </nav>
          </div>

          {/* Right: Search & Operational Status */}
          <div className="flex items-center gap-3">
            {/* Linear-Style Search Input */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[9px] bg-[#F7F6F3] border border-[#E6E3DE] text-xs text-[#6B6863] hover:border-[#D8D4CE] transition-all duration-180 ease-smooth cursor-pointer shadow-xs active:scale-[0.99]">
              <Search className="w-3.5 h-3.5 text-[#807365]" />
              <span className="text-[13px]">Quick search...</span>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[6px] bg-white border border-[#E6E3DE] text-[10px] font-mono text-[#807365] shadow-xs">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </div>

            <div className="h-4 w-[1px] bg-[#E6E3DE] hidden sm:block" />

            {/* Operational Status (Restrained Minimal Dot) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#F7F6F3] border border-[#E6E3DE] text-xs transition-colors duration-180">
              <span className="w-1.5 h-1.5 rounded-full bg-[#168060]" />
              <span className="text-[12px] font-medium text-[#6B6863]">Operational</span>
            </div>
          </div>
        </header>

        {/* Workspace Canvas (Warm Background: #F7F6F3) with full-width utilization and responsive padding */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F7F6F3] min-w-0">
          <div key={location.pathname} className="page-transition-enter w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
