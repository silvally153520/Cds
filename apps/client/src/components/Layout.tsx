import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, BedDouble, ShieldCheck, ChevronRight, ChevronDown, UserRound, ClipboardList, UserCircle, House, LayoutDashboard, LogOut } from 'lucide-react';
import { api, clearAuthSession, getAuthToken, getStoredUser } from '../lib/api';
import { CategoryNavigation } from './CategoryNavigation';
import { ChatWidget } from './ChatWidget';

type AccountUser = {
  fullName?: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
  hostApplication?: { status?: string } | null;
};

export function Layout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(() => getStoredUser());
  const role = user?.role;
  const isApprovedHost = role === 'HOST' && user?.hostApplication?.status === 'APPROVED';
  const showCategories = ['/rooms', '/explore'].includes(location.pathname);
  const isHostDashboard = location.pathname === '/host/dashboard';

  const navItems = [
    { label: 'Trang chủ', to: '/', end: true },
    { label: 'Khám phá', to: '/explore', end: false },
  ];

  useEffect(() => {
    const updateScroll = () => setIsScrolled(window.scrollY > 4);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const refreshUser = () => {
      const storedUser = getStoredUser();
      setUser(storedUser);
      if (!getAuthToken()) return;

      void api.get('/auth/me').then((response) => {
        const token = getAuthToken();
        if (token) {
          localStorage.setItem('sieuechxanh-user', JSON.stringify(response.data));
          setUser(response.data);
        }
      }).catch((error: { response?: { status?: number } }) => {
        if (error.response?.status === 401) clearAuthSession();
      });
    };

    refreshUser();
    window.addEventListener('sieuechxanh-auth-change', refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener('sieuechxanh-auth-change', refreshUser);
      window.removeEventListener('storage', refreshUser);
    };
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setAccountMenuOpen(false);
    navigate('/', { replace: true });
  };

  const displayName = user?.fullName || user?.email || 'Tài khoản';
  const initials = String(displayName).trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi');

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className={`sticky top-0 z-50 transition-shadow duration-300 ${isScrolled ? 'shadow-[0_8px_24px_rgba(15,23,42,0.08)]' : ''}`}>
        <header className="border-b border-slate-100 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link to="/" aria-label="Sieuechxanh - Trang chủ" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-md shadow-emerald-200/70 sm:h-11 sm:w-11">
                <BedDouble className="h-[21px] w-[21px]" strokeWidth={2.2} />
              </span>
              <span className="leading-none">
                <span className="block text-[17px] font-extrabold tracking-[-0.045em] text-slate-900 sm:text-[19px]">Sieuechxanh</span>
                <span className="mt-1.5 block text-[8px] font-bold uppercase tracking-[0.31em] text-emerald-700 sm:text-[9px]">Stay better</span>
              </span>
            </Link>

            <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) =>
                  `rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors duration-200 ${
                    isActive || (item.to === '/explore' && location.pathname === '/rooms') ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-700'
                  }`
                }>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {user ? (
                <div ref={accountMenuRef} className="relative z-[70]">
                  <button type="button" aria-label="Menu tài khoản" aria-expanded={accountMenuOpen} aria-haspopup="menu" onClick={() => setAccountMenuOpen((open) => !open)} className="flex max-w-[220px] items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm sm:gap-2.5 sm:pr-3">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{initials || <UserRound className="h-4 w-4" />}</span>}
                    <span className="hidden max-w-[105px] truncate text-sm font-semibold text-slate-700 sm:block">{displayName}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {accountMenuOpen && <div role="menu" style={{ top: showCategories ? 'calc(100% + 96px)' : 'calc(100% + 8px)' }} className="absolute right-0 z-[80] w-[280px] max-w-[calc(100vw-24px)] origin-top-right rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_12px_36px_rgba(15,23,42,0.14)]">
                    <div className="lg:hidden">
                      {navItems.map((item) => <NavLink key={item.to} role="menuitem" to={item.to} end={item.end} className={({ isActive }) => `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'}`}>{item.label}<ChevronRight className="h-4 w-4 opacity-50" /></NavLink>)}
                      <div className="my-1 border-t border-slate-100" />
                    </div>
                    {role !== 'ADMIN' && <Link role="menuitem" to="/bookings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"><ClipboardList className="h-4 w-4" />Đơn đặt phòng của tôi</Link>}
                    <Link role="menuitem" to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"><UserCircle className="h-4 w-4" />Hồ sơ của tôi</Link>
                    {role === 'USER' && user.hostApplication?.status !== 'APPROVED' && <Link role="menuitem" to="/host/register" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"><House className="h-4 w-4" />Trở thành Host{user.hostApplication?.status === 'PENDING' ? <span className="ml-auto text-[10px] font-bold text-amber-600">PENDING</span> : null}</Link>}
                    {isApprovedHost && <Link role="menuitem" to="/host/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"><LayoutDashboard className="h-4 w-4" />Dashboard Host</Link>}
                    {role === 'ADMIN' && <Link role="menuitem" to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"><ShieldCheck className="h-4 w-4" />Bảng quản trị</Link>}
                    <div className="my-1 border-t border-slate-100" />
                    <button role="menuitem" type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-700"><LogOut className="h-4 w-4" />Đăng xuất</button>
                  </div>}
                </div>
              ) : (
                <div ref={accountMenuRef} className="relative z-[70]">
                  <div className="hidden items-center gap-2 md:flex">
                    <Link to="/auth" className="rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-emerald-800">Đăng nhập</Link>
                    <Link to="/auth#register" className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-200 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md sm:px-4 sm:text-sm">Đăng ký ngay</Link>
                  </div>
                  <button type="button" aria-label="Mở menu" aria-expanded={accountMenuOpen} aria-haspopup="menu" onClick={() => setAccountMenuOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800 md:hidden">
                    <UserRound className="h-5 w-5" />
                    <ChevronDown className={`h-4 w-4 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {accountMenuOpen && <div role="menu" style={{ top: showCategories ? 'calc(100% + 96px)' : 'calc(100% + 8px)' }} className="absolute right-0 z-[80] w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_12px_36px_rgba(15,23,42,0.14)] md:hidden">
                    {navItems.map((item) => <NavLink key={item.to} role="menuitem" to={item.to} end={item.end} className={({ isActive }) => `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'}`}>{item.label}<ChevronRight className="h-4 w-4 opacity-50" /></NavLink>)}
                    <div className="my-1 border-t border-slate-100" />
                    <Link role="menuitem" to="/auth" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800">Đăng nhập</Link>
                    <Link role="menuitem" to="/auth#register" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50">Đăng ký ngay</Link>
                  </div>}
                </div>
              )}
            </div>
          </div>
        </header>
        {showCategories && <CategoryNavigation />}
      </div>

      <main className={isHostDashboard ? 'pb-0' : 'pb-10'}>{children}</main>

      <ChatWidget />

      {!isHostDashboard && <footer className="mt-20 border-t border-emerald-100 bg-slate-900 text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-900/30">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-white">Sieuechxanh</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Travel smart</p>
              </div>
            </div>
            <p className="text-sm leading-7 text-slate-300">
              Nền tảng đặt phòng nghỉ trực tuyến hiện đại, minh bạch và đáng tin cậy cho khách hàng và chủ nhà.
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Khám phá</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>Khách sạn nổi bật</li>
              <li>Resort biển</li>
              <li>Villa cho gia đình</li>
              <li>Chuyến đi cuối tuần</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Hỗ trợ</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>Trung tâm trợ giúp</li>
              <li>Chính sách hủy</li>
              <li>Điều khoản</li>
              <li>Liên hệ</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">An toàn</h3>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="text-sm text-slate-200">Thanh toán bảo mật và xác thực tài khoản.</p>
            </div>
          </div>
        </div>
      </footer>}
    </div>
  );
}
