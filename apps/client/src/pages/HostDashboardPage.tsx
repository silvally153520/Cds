import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import {
  ArrowDownRight,
  ArrowRight,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  HousePlus,
  LayoutDashboard,
  Menu,
  PackageOpen,
  RefreshCw,
  Settings2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, getStoredUser } from '../lib/api';
import { getCityLabel } from '../lib/location';
import { propertyTypeLabels } from '../lib/propertyCategories';
import './HostDashboardPage.css';

type DashboardSummary = {
  properties: number;
  rooms: number;
  physicalRooms: number;
  bookings: number;
  confirmed: number;
  pending: number;
  revenue: number;
};

type Room = {
  id: string;
  code?: string;
  name: string;
  type: string;
  basePrice: number;
  maxGuests: number;
  availableRooms: number;
  status: string;
  images: string[];
};

type Property = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  rejectionReason: string | null;
  address: string;
  city?: string | null;
  district?: string | null;
  images: string[];
  rooms: Room[];
};

type HostBooking = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  guestCount: number;
  roomCount: number;
  checkIn: string;
  checkOut: string;
  createdAt: string;
  user: { fullName: string; email: string };
  room: { name: string; type: string; property: { name: string } };
};

type HostNotification = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type ChartRange = 'day' | 'month' | 'year';
type RevenuePoint = { key: string; label: string; value: number };

const money = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN');
const bookingLabels: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã hủy',
  COMPLETED: 'Hoàn tất',
};
const propertyStatusLabels: Record<string, string> = {
  DRAFT: 'Chưa công khai',
  PENDING: 'Chưa công khai',
  PENDING_APPROVAL: 'Chưa công khai',
  ACTIVE: 'Đang hoạt động',
  APPROVED: 'Đang hoạt động',
  REJECTED: 'Chưa công khai',
  INACTIVE: 'Đang ẩn',
};
const successfulBookingStatuses = new Set(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED']);

const getErrorMessage = (error: unknown, fallback: string) => (
  isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? fallback : fallback
);

function buildRevenuePoints(bookings: HostBooking[], range: ChartRange): RevenuePoint[] {
  const now = new Date();
  const points: RevenuePoint[] = [];

  if (range === 'day') {
    for (let offset = 13; offset >= 0; offset -= 1) {
      const current = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      points.push({
        key: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
        label: current.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        value: 0,
      });
    }
  } else if (range === 'month') {
    for (let offset = 11; offset >= 0; offset -= 1) {
      const current = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      points.push({
        key: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        label: current.toLocaleDateString('vi-VN', { month: 'short' }),
        value: 0,
      });
    }
  } else {
    for (let offset = 4; offset >= 0; offset -= 1) {
      const year = now.getFullYear() - offset;
      points.push({ key: String(year), label: String(year), value: 0 });
    }
  }

  const pointByKey = new Map(points.map((point) => [point.key, point]));
  for (const booking of bookings) {
    if (!successfulBookingStatuses.has(booking.status)) continue;
    const createdAt = new Date(booking.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;
    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const day = String(createdAt.getDate()).padStart(2, '0');
    const key = range === 'day' ? `${year}-${month}-${day}` : range === 'month' ? `${year}-${month}` : String(year);
    const point = pointByKey.get(key);
    if (point) point.value += booking.totalPrice;
  }

  return points;
}

export function HostDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [notifications, setNotifications] = useState<HostNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingRoom, setSavingRoom] = useState('');
  const [chartRange, setChartRange] = useState<ChartRange>('month');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('host-overview');
  const user = getStoredUser() as { fullName?: string } | null;

  const loadData = useCallback(async () => {
    try {
      const [summaryRes, propertiesRes, bookingsRes, notificationsRes] = await Promise.all([
        api.get<DashboardSummary>('/host/dashboard'),
        api.get<Property[]>('/host/properties'),
        api.get<HostBooking[]>('/host/bookings'),
        api.get<HostNotification[]>('/host/notifications'),
      ]);
      setSummary(summaryRes.data);
      setProperties(propertiesRes.data);
      setBookings(bookingsRes.data);
      setNotifications(notificationsRes.data);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Không thể tải dữ liệu dashboard Host.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 30000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const revenuePoints = useMemo(() => buildRevenuePoints(bookings, chartRange), [bookings, chartRange]);
  const recentBookings = bookings.slice(0, 8);
  const recentProperties = properties.slice(0, 6);
  const roomEntries = properties.flatMap((property) => property.rooms.map((room) => ({ property, room })));
  const maxRevenue = Math.max(0, ...revenuePoints.map((point) => point.value));
  const successfulBookingCount = bookings.filter((booking) => successfulBookingStatuses.has(booking.status)).length;
  const displayName = user?.fullName?.trim() || 'Host';

  const updateStayStatus = async (bookingId: string, status: 'CHECKED_IN' | 'CHECKED_OUT') => {
    try {
      await api.patch(`/host/bookings/${bookingId}/stay-status`, { status });
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Không thể cập nhật trạng thái lưu trú.'));
    }
  };

  const updateRoom = async (room: Room, availableRooms: number, status: string) => {
    setSavingRoom(room.id);
    try {
      await api.patch(`/host/rooms/${room.id}/inventory`, { availableRooms, status });
      await loadData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Không thể cập nhật lịch phòng.'));
    } finally {
      setSavingRoom('');
    }
  };

  const markRead = async (notificationId: string) => {
    try {
      await api.patch(`/host/notifications/${notificationId}/read`);
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Không thể đánh dấu thông báo đã đọc.'));
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="host-dashboard">
      {mobileMenuOpen && <button type="button" className="host-drawer-backdrop" aria-label="Đóng menu" onClick={closeMobileMenu} />}
      <aside className={`host-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="host-sidebar-heading">
          {!sidebarCollapsed && <span>QUẢN LÝ HOST</span>}
          <button type="button" className="host-sidebar-collapse" aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} onClick={() => setSidebarCollapsed((current) => !current)}>
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          <button type="button" className="host-sidebar-close" aria-label="Đóng menu" onClick={closeMobileMenu}><X size={20} /></button>
        </div>
        <nav className="host-sidebar-nav" aria-label="Điều hướng Host">
          <SidebarLink href="#host-overview" label="Tổng quan" icon={LayoutDashboard} active={activeSection === 'host-overview'} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} onSelect={() => setActiveSection('host-overview')} />
          <SidebarLink to="/host/properties" label="Cơ sở lưu trú" icon={Building2} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} />
          <SidebarLink to="/host/properties/new" label="Thêm cơ sở" icon={HousePlus} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} />
          <SidebarLink href="#host-rooms" label="Loại phòng" icon={BedDouble} active={activeSection === 'host-rooms'} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} onSelect={() => setActiveSection('host-rooms')} />
          <SidebarLink to="/host/calendar" label="Lịch phòng" icon={CalendarDays} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} />
          <SidebarLink href="#host-bookings" label="Đơn đặt phòng" icon={ClipboardList} active={activeSection === 'host-bookings'} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} onSelect={() => setActiveSection('host-bookings')} />
          <SidebarLink href="#host-revenue" label="Doanh thu" icon={CircleDollarSign} active={activeSection === 'host-revenue'} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} onSelect={() => setActiveSection('host-revenue')} />
          <SidebarLink to="/profile" label="Hồ sơ Host" icon={UserRound} collapsed={sidebarCollapsed} onNavigate={closeMobileMenu} />
        </nav>
        {!sidebarCollapsed && <div className="host-sidebar-help"><span className="host-help-icon"><Settings2 size={18} /></span><div><strong>Cần hỗ trợ?</strong><span>Quản lý kỳ nghỉ của bạn</span></div><ChevronRight size={16} /></div>}
      </aside>

      <div className="host-dashboard-content">
        <div className="host-mobile-toolbar">
          <button type="button" aria-label="Mở menu Host" onClick={() => setMobileMenuOpen(true)}><Menu size={19} /> Menu quản lý</button>
          <span>Dashboard Host</span>
        </div>

        <div className="host-main">
          <section id="host-overview" className="host-welcome">
            <div className="host-welcome-copy">
              <p className="host-eyebrow">HOST DASHBOARD</p>
              <h1>Xin chào, {displayName}!</h1>
              <p>Quản lý cơ sở lưu trú, loại phòng, lịch đặt và doanh thu của bạn.</p>
            </div>
            <Link to="/host/properties/new" className="host-primary-button"><HousePlus size={18} /> Thêm cơ sở lưu trú</Link>
          </section>

          {error && <div role="alert" className="host-error">
            <div><strong>Không thể tải dữ liệu</strong><span>{error}</span></div>
            <button type="button" onClick={() => { setLoading(true); void loadData(); }} disabled={loading}><RefreshCw size={16} className={loading ? 'host-spin' : ''} /> Thử lại</button>
          </div>}

          <section className="host-stats-grid" aria-label="Thống kê tổng quan">
            <StatCard label="Cơ sở lưu trú" value={summary?.properties ?? 0} icon={Building2} tone="green" loading={loading} failed={Boolean(error)} />
            <StatCard label="Loại phòng" value={summary?.rooms ?? 0} icon={BedDouble} tone="blue" loading={loading} failed={Boolean(error)} />
            <StatCard label="Phòng thực tế" value={summary?.physicalRooms ?? 0} icon={PackageOpen} tone="violet" loading={loading} failed={Boolean(error)} />
            <StatCard label="Tổng đơn đặt phòng" value={summary?.bookings ?? 0} icon={ClipboardList} tone="orange" loading={loading} failed={Boolean(error)} />
            <StatCard label="Đơn thanh toán chờ" value={summary?.pending ?? 0} icon={Clock3} tone="amber" loading={loading} failed={Boolean(error)} />
            <StatCard label="Tổng doanh thu" value={money(summary?.revenue ?? 0)} icon={CircleDollarSign} tone="teal" loading={loading} failed={Boolean(error)} />
          </section>

          <section className="host-section host-properties-section" id="host-properties">
            <SectionHeading eyebrow="KHÔNG GIAN CỦA BẠN" title="Cơ sở lưu trú của tôi" action={<Link to="/host/properties" className="host-text-link">Xem tất cả <ArrowRight size={16} /></Link>} />
            {loading ? <PropertySkeletonGrid /> : error ? <DataUnavailable message="Không thể tải danh sách cơ sở lưu trú." /> : recentProperties.length ? (
              <div className="host-property-grid">
                {recentProperties.map((property) => <PropertyCard key={property.id} property={property} />)}
              </div>
            ) : (
              <div className="host-empty-state">
                <span className="host-empty-icon"><Building2 size={27} /></span>
                <h3>Bạn chưa có cơ sở lưu trú nào</h3>
                <p>Bắt đầu giới thiệu không gian của bạn đến những vị khách tiếp theo.</p>
                <Link to="/host/properties/new" className="host-primary-button"><HousePlus size={17} /> Thêm cơ sở lưu trú đầu tiên</Link>
              </div>
            )}
          </section>

          <section className="host-section" id="host-rooms">
            <SectionHeading eyebrow="SẢN PHẨM LƯU TRÚ" title="Loại phòng của tôi" action={<Link to={properties[0] ? `/host/properties/${properties[0].id}/edit` : '/host/properties/new'} className="host-outline-button"><HousePlus size={16} /> Thêm loại phòng</Link>} />
            {loading ? <RoomSkeletonRows /> : error ? <DataUnavailable message="Không thể tải danh sách loại phòng." /> : roomEntries.length ? (
              <>
                <div className="host-room-table-wrap">
                  <table className="host-room-table">
                    <thead><tr><th>Loại phòng</th><th>Cơ sở lưu trú</th><th>Giá mỗi đêm</th><th>Sức chứa</th><th>Số lượng</th><th>Trạng thái</th><th /></tr></thead>
                    <tbody>{roomEntries.slice(0, 8).map(({ property, room }) => (
                      <tr key={room.id}>
                        <td><div className="host-room-name">{room.images?.[0] ? <img src={room.images[0]} alt="" /> : <span><BedDouble size={17} /></span>}<div><strong>{room.name}</strong><small>{room.type}</small></div></div></td>
                        <td>{property.name}</td>
                        <td className="host-price">{money(room.basePrice)} <small>/ đêm</small></td>
                        <td><UsersRound size={15} /> {room.maxGuests} khách</td>
                        <td>{room.availableRooms} phòng</td>
                        <td><StatusPill value={room.status} /></td>
                        <td><div className="host-room-actions"><Link to={`/host/properties/${property.id}/edit`}>Sửa</Link><Link aria-label={`Quản lý giá và lịch ${room.name}`} to={`/host/calendar?propertyId=${property.id}`} className="host-icon-link"><CalendarDays size={17} /></Link></div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="host-room-cards">
                  {roomEntries.slice(0, 8).map(({ property, room }) => <article className="host-room-card" key={room.id}>
                    <div className="host-room-card-top">{room.images?.[0] ? <img src={room.images[0]} alt="" /> : <span className="host-room-placeholder"><BedDouble size={20} /></span>}<div><strong>{room.name}</strong><span>{property.name}</span></div><StatusPill value={room.status} /></div>
                    <div className="host-room-card-info"><span>{money(room.basePrice)} / đêm</span><span>{room.maxGuests} khách · {room.availableRooms} phòng</span></div>
                    <div className="host-room-card-actions"><Link to={`/host/properties/${property.id}/edit`}>Chi tiết / Chỉnh sửa</Link><Link to={`/host/calendar?propertyId=${property.id}`}><CalendarDays size={15} /> Giá & lịch phòng</Link></div>
                  </article>)}
                </div>
                {roomEntries.length > 8 && <Link to="/host/properties" className="host-list-more">Xem tất cả {roomEntries.length} loại phòng <ArrowRight size={15} /></Link>}
              </>
            ) : <div className="host-inline-empty"><BedDouble size={20} /><span>Chưa có loại phòng. Tạo loại phòng trong hồ sơ cơ sở lưu trú của bạn.</span></div>}
          </section>

          <section className="host-section host-revenue-section" id="host-revenue">
            <div className="host-revenue-header">
              <SectionHeading eyebrow="HIỆU QUẢ KINH DOANH" title="Doanh thu" />
              <div className="host-range-select" role="group" aria-label="Khoảng thời gian doanh thu">
                {([['day', 'Ngày'], ['month', 'Tháng'], ['year', 'Năm']] as const).map(([range, label]) => (
                  <button type="button" key={range} className={chartRange === range ? 'is-active' : ''} aria-pressed={chartRange === range} onClick={() => setChartRange(range)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="host-revenue-summary">
              <div><span>Tổng doanh thu</span><strong>{money(summary?.revenue ?? 0)}</strong><small>Dựa trên các đơn chưa bị hủy</small></div>
              <div className="host-success-count"><span>Đơn thành công</span>              <strong>{loading ? <span className="host-skeleton host-success-skeleton" /> : successfulBookingCount}</strong><small><Check size={14} /> Đã xác nhận hoặc hoàn tất</small></div>
            </div>
            {loading ? <div className="host-chart-skeleton" /> : error ? <DataUnavailable message="Không thể tải dữ liệu doanh thu." /> : (
              <div className="host-chart" aria-label={`Biểu đồ doanh thu theo ${chartRange === 'day' ? 'ngày' : chartRange === 'month' ? 'tháng' : 'năm'}`}>
                <div className="host-chart-grid">
                  <span>{money(maxRevenue)}</span><span>{money(maxRevenue / 2)}</span><span>0 ₫</span>
                  <div className="host-chart-bars">{revenuePoints.map((point) => (
                    <div className="host-chart-column" key={point.key} title={`${point.label}: ${money(point.value)}`}>
                      <div className="host-chart-bar-wrap"><span className="host-chart-bar" style={{ height: maxRevenue ? `${Math.max(point.value ? 4 : 0, (point.value / maxRevenue) * 100)}%` : '0%' }} /></div>
                      <small>{point.label}</small>
                    </div>
                  ))}</div>
                </div>
                {!revenuePoints.some((point) => point.value > 0) && <p className="host-chart-empty">Chưa có doanh thu trong khoảng thời gian này.</p>}
              </div>
            )}
          </section>

          <section className="host-section" id="host-inventory">
            <SectionHeading eyebrow="TÌNH TRẠNG PHÒNG" title="Quản lý tồn phòng" action={<Link to="/host/calendar" className="host-text-link">Mở lịch phòng <ArrowRight size={16} /></Link>} />
            {loading ? <RoomSkeletonRows /> : error ? <DataUnavailable message="Không thể tải số lượng phòng." /> : roomEntries.length ? (
              <div className="host-inventory-list">{roomEntries.slice(0, 6).map(({ property, room }) => (
                <RoomInventory key={`${room.id}-${room.availableRooms}-${room.status}`} propertyName={property.name} room={room} saving={savingRoom === room.id} onSave={updateRoom} />
              ))}</div>
            ) : <div className="host-inline-empty"><PackageOpen size={20} /><span>Thêm cơ sở và loại phòng để quản lý tồn phòng.</span></div>}
          </section>

          <section className="host-section" id="host-bookings">
            <SectionHeading eyebrow="CẬP NHẬT MỚI NHẤT" title="Đơn đặt phòng gần đây" action={<span className="host-live-indicator"><i /> Cập nhật mỗi 30 giây</span>} />
            {loading ? <BookingSkeleton /> : error ? <DataUnavailable message="Không thể tải danh sách đơn đặt phòng." /> : bookings.length ? (
              <>
                <div className="host-booking-table-wrap">
                  <table className="host-booking-table">
                    <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Cơ sở lưu trú · Loại phòng</th><th>Nhận phòng</th><th>Trả phòng</th><th>Tổng tiền</th><th>Trạng thái</th><th>Lưu trú</th></tr></thead>
                    <tbody>{recentBookings.map((booking) => <tr key={booking.id}>
                      <td><strong className="host-booking-code">{booking.code}</strong></td>
                      <td><strong>{booking.user.fullName}</strong><small>{booking.user.email}</small></td>
                      <td><strong>{booking.room.property.name}</strong><small>{booking.room.name}</small></td>
                      <td>{date(booking.checkIn)}</td><td>{date(booking.checkOut)}</td>
                      <td className="host-price">{money(booking.totalPrice)}</td>
                      <td><StatusPill value={booking.status} /></td>
                      <td>{booking.status === 'CONFIRMED' && <button type="button" className="host-stay-action" onClick={() => void updateStayStatus(booking.id, 'CHECKED_IN')}>Check-in</button>}{booking.status === 'CHECKED_IN' && <button type="button" className="host-stay-action" onClick={() => void updateStayStatus(booking.id, 'CHECKED_OUT')}>Check-out</button>}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="host-booking-cards">{recentBookings.map((booking) => (
                  <article className="host-booking-card" key={booking.id}>
                    <div className="host-booking-card-heading"><strong>{booking.code}</strong><StatusPill value={booking.status} /></div>
                    <strong>{booking.user.fullName}</strong><span>{booking.user.email}</span>
                    <p>{booking.room.property.name} · {booking.room.name}</p>
                    <div className="host-booking-dates"><span>Nhận phòng <strong>{date(booking.checkIn)}</strong></span><span>Trả phòng <strong>{date(booking.checkOut)}</strong></span></div>
                    <div className="host-booking-card-bottom"><strong>{money(booking.totalPrice)}</strong>{booking.status === 'CONFIRMED' && <button type="button" onClick={() => void updateStayStatus(booking.id, 'CHECKED_IN')}>Check-in</button>}{booking.status === 'CHECKED_IN' && <button type="button" onClick={() => void updateStayStatus(booking.id, 'CHECKED_OUT')}>Check-out</button>}</div>
                  </article>
                ))}</div>
                {bookings.length > recentBookings.length && <Link to="/host/dashboard#host-bookings" className="host-list-more">Đang hiển thị {recentBookings.length} / {bookings.length} đơn gần nhất <ArrowDownRight size={15} /></Link>}
                <p className="host-booking-note">Đơn đặt phòng được xác nhận tự động theo nghiệp vụ hiện tại; Host không cần duyệt đơn.</p>
              </>
            ) : <div className="host-inline-empty"><ClipboardList size={20} /><span>Chưa có đơn đặt phòng nào.</span></div>}
          </section>

          <section className="host-section host-quick-section">
            <SectionHeading eyebrow="BẮT ĐẦU NHANH" title="Thao tác nhanh" />
            <div className="host-quick-actions">
              <QuickAction to="/host/properties/new" icon={HousePlus} title="Thêm cơ sở lưu trú" text="Giới thiệu nơi nghỉ của bạn" />
              <QuickAction to={properties[0] ? `/host/properties/${properties[0].id}/edit` : '/host/properties/new'} icon={BedDouble} title="Thêm loại phòng" text="Cập nhật phòng và giá bán" />
              <QuickAction to="/host/calendar" icon={CalendarDays} title="Quản lý lịch phòng" text="Điều chỉnh giá và tình trạng" />
              <QuickAction to="/host/dashboard#host-bookings" icon={ClipboardList} title="Xem đơn đặt phòng" text="Theo dõi các kỳ lưu trú" />
              <QuickAction to="/profile" icon={UserRound} title="Cập nhật hồ sơ Host" text="Thông tin tài khoản của bạn" />
            </div>
          </section>

          <section className="host-section host-notifications">
            <SectionHeading eyebrow="CẬP NHẬT" title="Thông báo mới" />
            {loading ? <div className="host-notification-skeleton" /> : error ? <DataUnavailable message="Không thể tải thông báo." /> : notifications.length ? <div className="host-notification-list">
              {notifications.slice(0, 5).map((notification) => <article key={notification.id} className={`host-notification ${notification.readAt ? '' : 'is-unread'}`}>
                <span className="host-notification-icon"><ClipboardList size={17} /></span>
                <div><strong>{notification.title}</strong><p>{notification.message}</p><small>{new Date(notification.createdAt).toLocaleString('vi-VN')}</small></div>
                {!notification.readAt && <button type="button" onClick={() => void markRead(notification.id)}>Đánh dấu đã đọc</button>}
              </article>)}
            </div> : <div className="host-inline-empty"><ClipboardList size={20} /><span>Chưa có thông báo mới.</span></div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ to, href, label, icon: Icon, active = false, collapsed, onNavigate, onSelect }: {
  to?: string;
  href?: string;
  label: string;
  icon: typeof LayoutDashboard;
  active?: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  onSelect?: () => void;
}) {
  const className = `host-sidebar-link ${active ? 'is-active' : ''}`;
  const content = <><Icon size={19} /><span>{label}</span>{collapsed && <small>{label}</small>}</>;
  return to
    ? <Link to={to} title={label} className={className} onClick={() => { onNavigate(); onSelect?.(); }}>{content}</Link>
    : <a href={href} title={label} className={className} onClick={() => { onNavigate(); onSelect?.(); }}>{content}</a>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="host-section-heading"><div><p>{eyebrow}</p><h2>{title}</h2></div>{action}</div>;
}

function StatCard({ label, value, icon: Icon, tone, loading, failed }: {
  label: string;
  value: number | string;
  icon: typeof LayoutDashboard;
  tone: string;
  loading: boolean;
  failed: boolean;
}) {
  return <article className={`host-stat-card tone-${tone}`}><span className="host-stat-icon"><Icon size={20} /></span><div className="host-stat-value">{loading ? <span className="host-skeleton host-stat-skeleton" /> : failed ? 'Lỗi' : value}</div><p>{label}</p></article>;
}

function DataUnavailable({ message }: { message: string }) {
  return <div className="host-inline-empty"><RefreshCw size={18} /><span>{message}</span></div>;
}

function StatusPill({ value, label: customLabel }: { value: string; label?: string }) {
  const label = customLabel ?? bookingLabels[value] ?? (value === 'ACTIVE' ? 'Đang hoạt động' : value === 'INACTIVE' ? 'Tạm đóng' : propertyStatusLabels[value] ?? value);
  const tone = ['ACTIVE', 'APPROVED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(value) ? 'success'
    : ['PENDING', 'PENDING_APPROVAL'].includes(value) ? 'warning'
      : ['CANCELLED', 'REJECTED'].includes(value) ? 'danger' : 'neutral';
  return <span className={`host-status-pill status-${tone}`}>{label}</span>;
}

function PropertyCard({ property }: { property: Property }) {
  const roomCount = property.rooms.reduce((sum, room) => sum + room.availableRooms, 0);
  return <article className="host-property-card">
    <div className="host-property-cover">
      {property.images?.[0] ? <img src={property.images[0]} alt={property.name} /> : <div className="host-property-cover-empty"><Building2 size={28} /><span>Chưa có ảnh đại diện</span></div>}
      <StatusPill value={property.status} label={propertyStatusLabels[property.status] ?? property.status} />
    </div>
    <div className="host-property-body">
      <div className="host-property-title"><div><span>{propertyTypeLabels[property.type] ?? property.type}</span><h3>{property.name}</h3></div><span className={`host-activity-dot ${property.status === 'ACTIVE' ? 'is-active' : ''}`} title={property.status === 'ACTIVE' ? 'Đang hoạt động' : 'Chưa hoạt động'} /></div>
      <p className="host-property-location">{property.district ? `${property.district}, ` : ''}{getCityLabel(property.city)}</p>
      <div className="host-property-metrics"><span><BedDouble size={15} /> {property.rooms.length} loại phòng</span><span><PackageOpen size={15} /> {roomCount} phòng</span></div>
      {property.rejectionReason && <p className="host-rejection-reason">{property.rejectionReason}</p>}
      <div className="host-property-actions">
        <Link to={`/host/properties/${property.id}/edit`}>Chi tiết / Chỉnh sửa</Link>
        <Link to={`/host/properties/${property.id}/edit`}>Quản lý phòng</Link>
        <Link aria-label={`Quản lý lịch ${property.name}`} to={`/host/calendar?propertyId=${property.id}`}><CalendarDays size={16} /></Link>
      </div>
    </div>
  </article>;
}

function QuickAction({ to, icon: Icon, title, text }: { to: string; icon: typeof LayoutDashboard; title: string; text: string }) {
  return <Link to={to} className="host-quick-action"><span><Icon size={19} /></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={17} /></Link>;
}

function PropertySkeletonGrid() {
  return <div className="host-property-grid">{[0, 1, 2].map((item) => <div className="host-property-skeleton" key={item}><span className="host-skeleton" /><div className="host-skeleton-lines"><span className="host-skeleton" /><span className="host-skeleton" /></div></div>)}</div>;
}

function RoomSkeletonRows() {
  return <div className="host-skeleton-list">{[0, 1, 2].map((item) => <span className="host-skeleton" key={item} />)}</div>;
}

function BookingSkeleton() {
  return <div className="host-booking-skeleton">{[0, 1, 2].map((item) => <span className="host-skeleton" key={item} />)}</div>;
}

function RoomInventory({ propertyName, room, saving, onSave }: {
  propertyName: string;
  room: Room;
  saving: boolean;
  onSave: (room: Room, availableRooms: number, status: string) => Promise<void>;
}) {
  const [count, setCount] = useState(room.availableRooms);
  const [status, setStatus] = useState(room.status);

  return <div className="host-inventory-row">
    <div className="host-inventory-description"><span><BedDouble size={18} /></span><div><strong>{propertyName} · {room.name}</strong><small>Số phòng có thể bán</small></div></div>
    <div className="host-inventory-controls">
      <label><span className="sr-only">Số lượng phòng {room.name}</span><input type="number" min={0} max={500} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
      <label><span className="sr-only">Tình trạng {room.name}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">Đang mở bán</option><option value="INACTIVE">Tạm đóng</option></select></label>
      <button type="button" disabled={saving} onClick={() => void onSave(room, count, status)}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
    </div>
  </div>;
}
