import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ShoppingCart, Package, Users,
  BarChart3, Settings, ChevronLeft, ChevronRight, Receipt,
  Building2, Search, Menu, LogOut, ArrowLeftRight, Wallet, FilePlus2
} from 'lucide-react';
import { todayBS, formatBS } from '@/lib/bs-calendar';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAppShortcuts } from '@/hooks/useAppShortcuts';
import { localDb } from '@/integrations/local-db/client';
import { useQuery } from '@tanstack/react-query';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Sales', icon: FileText, path: '/invoices' },
  { label: 'Purchases', icon: ShoppingCart, path: '/purchases' },
  { label: 'CN / DN', icon: FilePlus2, path: '/correction-notes' },
  { label: 'Quotations', icon: Receipt, path: '/quotations' },
  { label: 'Inventory', icon: Package, path: '/inventory' },
  { label: 'Stock Movements', icon: ArrowLeftRight, path: '/inventory/movements' },
  { label: 'Payments', icon: Wallet, path: '/payments' },
  { label: 'Parties', icon: Users, path: '/parties' },
  { label: 'Reports', icon: BarChart3, path: '/reports' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const today = todayBS();
  const { signOut, user } = useAuth();
  const { business } = useBusiness();
  useAppShortcuts();

  const searchQuery = search.trim();
  const { data: searchResults = [] } = useQuery({
    queryKey: ['global-search', business?.id, searchQuery],
    enabled: !!business?.id && searchQuery.length >= 2,
    queryFn: async () => {
      const term = `%${searchQuery}%`;
      const [invoiceRes, partyRes, itemRes] = await Promise.all([
        localDb
          .from('invoices')
          .select('id, invoice_number, type, total_amount')
          .eq('business_id', business!.id)
          .is('deleted_at', null)
          .ilike('invoice_number', term)
          .limit(5),
        localDb
          .from('parties')
          .select('id, name, type, phone')
          .eq('business_id', business!.id)
          .is('deleted_at', null)
          .ilike('name', term)
          .limit(5),
        localDb
          .from('items')
          .select('id, name, code, type')
          .eq('business_id', business!.id)
          .is('deleted_at', null)
          .ilike('name', term)
          .limit(5),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      if (partyRes.error) throw partyRes.error;
      if (itemRes.error) throw itemRes.error;

      return [
        ...(invoiceRes.data || []).map((invoice) => ({
          id: invoice.id,
          label: invoice.invoice_number,
          detail: `${invoice.type} · NPR ${Number(invoice.total_amount || 0).toLocaleString('en-IN')}`,
          path: invoice.type === 'purchase' ? `/invoices/${invoice.id}` : `/invoices/${invoice.id}`,
          type: 'Invoice',
        })),
        ...(partyRes.data || []).map((party) => ({
          id: party.id,
          label: party.name,
          detail: `${party.type}${party.phone ? ` · ${party.phone}` : ''}`,
          path: `/parties/${party.id}`,
          type: 'Party',
        })),
        ...(itemRes.data || []).map((item) => ({
          id: item.id,
          label: item.name,
          detail: `${item.type}${item.code ? ` · ${item.code}` : ''}`,
          path: '/inventory',
          type: 'Item',
        })),
      ];
    },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSearchSelect = (path: string) => {
    setSearch('');
    setSearchOpen(false);
    navigate(path);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 lg:static lg:z-auto ${collapsed ? 'w-16' : 'w-60'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground text-sm">V</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="truncate font-bold text-sm text-sidebar-accent-foreground">Vyapar Nepal</h1>
              <p className="truncate text-[10px] text-sidebar-muted">Billing & Inventory</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map((item) => {
            const isActive = item.path === '/inventory'
              ? location.pathname === item.path
              : location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                className={`mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'}`}>
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <button onClick={handleSignOut}
          className="flex items-center gap-3 px-5 py-3 text-sm text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors border-t border-sidebar-border">
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{business?.name || 'No Business'}</span>
            {business?.pan_number && <span className="hidden sm:inline">• PAN: {business.pan_number}</span>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground">{formatBS(today)}</span>
            <div className="relative hidden sm:block">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <label htmlFor="global-search" className="sr-only">Search invoices, parties, items</label>
                <input
                  id="global-search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search invoices, parties, items..."
                  className="w-56 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              {searchOpen && searchQuery.length >= 2 && (
                <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No matching records found.</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto py-1">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSearchSelect(result.path)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                        >
                          <span className="mt-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{result.type}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">{result.label}</span>
                            <span className="block truncate text-muted-foreground">{result.detail}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold"
              aria-label={`Signed in as ${user?.user_metadata?.name || user?.email || 'user'}`}
            >
              {user?.user_metadata?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
