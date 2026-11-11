import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getCityLabel } from '../lib/location';

type Summary = {
  totalUsers: number;
  totalBookings: number;
  totalProperties: number;
  pendingApplications: number;
  revenue: number;
};
type HostApplication = {
  id: string;
  status: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  reason: string | null;
  cccd: string | null;
  user: { email: string; fullName: string };
};
type AdminBooking = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  guestCount: number;
  roomCount: number;
  checkIn: string;
  checkOut: string;
  user: { id: string; fullName: string; email: string };
  room: {
    name: string;
    type: string;
    property: { name: string; host: { id: string; fullName: string } };
  };
};
type ReviewProperty = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  rejectionReason: string | null;
  images: string[];
  address: string;
  city?: string | null;
  district?: string | null;
  description: string;
  amenities: string[];
  policies: string[];
  rooms: { id: string; name: string; code: string; basePrice: number | string; availableRooms: number; images: string[] }[];
  host: { fullName: string; email: string };
};

const money = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN');
const statusNames: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã nhận phòng',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã hủy',
  COMPLETED: 'Hoàn tất',
};

export function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [properties, setProperties] = useState<ReviewProperty[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [filterOptions, setFilterOptions] = useState<AdminBooking[]>([]);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hostId, setHostId] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [summaryRes, appRes, optionsRes, propertiesRes] = await Promise.all([
        api.get('/admin/summary'),
        api.get('/admin/host-applications'),
        api.get('/admin/bookings'),
        api.get('/admin/properties'),
      ]);
      setSummary(summaryRes.data);
      setApplications(appRes.data);
      setProperties(propertiesRes.data);
      setFilterOptions(optionsRes.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể tải dữ liệu quản trị.');
    }
  }, []);

  const loadBookings = useCallback(async () => {
    try {
      const response = await api.get('/admin/bookings', { params: { status: status || undefined, from: from || undefined, to: to || undefined, hostId: hostId || undefined, userId: userId || undefined } });
      setBookings(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể tải danh sách đơn.');
    }
  }, [status, from, to, hostId, userId]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { void loadBookings(); }, [loadBookings]);

  const handleDecision = async (applicationId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await api.patch(`/admin/host-applications/${applicationId}`, { status: decision, rejectionReason: decision === 'REJECTED' ? 'Không đáp ứng yêu cầu hồ sơ.' : undefined });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể cập nhật đơn đăng ký.');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      await api.patch(`/admin/bookings/${bookingId}`, { status: 'CANCELLED' });
      await Promise.all([loadData(), loadBookings()]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể hủy booking.');
    }
  };

  const decideProperty = async (property: ReviewProperty, status: 'APPROVED' | 'REJECTED') => {
    const rejectionReason = status === 'REJECTED'
      ? window.prompt(`Lý do từ chối "${property.name}"?`)?.trim()
      : undefined;
    if (status === 'REJECTED' && !rejectionReason) return;
    try {
      await api.patch(`/admin/properties/${property.id}`, { status, rejectionReason });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể cập nhật trạng thái cơ sở lưu trú.');
    }
  };

  const uniqueHosts = Array.from(new Map(filterOptions.map((booking) => [booking.room.property.host.id, booking.room.property.host.fullName])).entries());
  const uniqueUsers = Array.from(new Map(filterOptions.map((booking) => [booking.user.id, `${booking.user.fullName} · ${booking.user.email}`])).entries());

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Admin</p>
        <h1 className="mt-2 text-4xl font-black text-slate-900">Bảng điều khiển quản trị</h1>
      </div>
      {error && <p className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {summary && <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Metric value={summary.totalUsers} label="Người dùng" />
        <Metric value={summary.totalBookings} label="Đơn đặt phòng" />
        <Metric value={summary.totalProperties} label="Cơ sở lưu trú" />
        <Metric value={summary.pendingApplications} label="Host chờ duyệt" />
        <Metric value={money(summary.revenue)} label="Doanh thu booking còn hiệu lực" />
      </div>}

      <section className="mt-10 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black text-slate-900">Kiểm duyệt cơ sở lưu trú</h2><p className="mt-1 text-sm text-slate-500">Xem thông tin, ảnh và loại phòng trước khi công khai.</p></div>
        <div className="divide-y divide-slate-100">
          {properties.filter((property) => ['PENDING', 'PENDING_APPROVAL', 'REJECTED'].includes(property.status)).map((property) => (
            <article key={property.id} className="grid gap-5 p-5 lg:grid-cols-[180px_1fr_auto]">
              <div className="grid grid-cols-2 gap-2">
                {property.images.slice(0, 4).map((image) => <img key={image} src={image} alt={property.name} className="h-20 w-full rounded-xl object-cover" />)}
                {!property.images.length && <div className="col-span-2 flex h-20 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">Chưa có ảnh</div>}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-900">{property.name}</h3><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{property.status}</span></div>
                <p className="text-sm text-slate-500">{property.code ?? '—'} · {property.type} · {property.address}, {property.district ? `${property.district}, ` : ''}{getCityLabel(property.city)}</p>
                <p className="mt-2 text-sm text-slate-700">{property.description}</p>
                <p className="mt-2 text-sm text-slate-600">Host: {property.host.fullName} · {property.host.email} · {property.rooms.length} loại phòng</p>
                <ul className="mt-2 space-y-2">{property.rooms.map((room) => <li key={room.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700"><span className="min-w-0 flex-1">{room.name} · {money(Number(room.basePrice))} · {room.availableRooms} phòng</span><span className="flex gap-1">{room.images.slice(0, 3).map((image) => <img key={image} src={image} alt={`Ảnh ${room.name}`} className="h-10 w-12 rounded-md object-cover" />)}</span></li>)}</ul>
                {property.rejectionReason && <p className="mt-2 text-sm text-red-700">Lý do từ chối trước đó: {property.rejectionReason}</p>}
              </div>
              <div className="flex items-start gap-2 lg:flex-col">
                <button onClick={() => void decideProperty(property, 'APPROVED')} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Duyệt</button>
                <button onClick={() => void decideProperty(property, 'REJECTED')} className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Từ chối</button>
              </div>
            </article>
          ))}
          {properties.every((property) => !['PENDING', 'PENDING_APPROVAL', 'REJECTED'].includes(property.status)) && <p className="p-8 text-center text-sm text-slate-500">Không có cơ sở đang chờ kiểm duyệt.</p>}
        </div>
      </section>

      <section className="mt-10 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black text-slate-900">Theo dõi booking</h2><p className="mt-1 text-sm text-slate-500">Booking được xác nhận tự động; Admin có thể lọc và xử lý hủy đơn.</p></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <select aria-label="Lọc trạng thái booking" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Tất cả trạng thái</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input aria-label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
          <input aria-label="Đến ngày" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
          <select aria-label="Lọc theo Host" value={hostId} onChange={(event) => setHostId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Tất cả Host</option>{uniqueHosts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select aria-label="Lọc theo khách hàng" value={userId} onChange={(event) => setUserId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">Tất cả khách hàng</option>{uniqueUsers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="px-5 py-3">Mã đơn / khách</th><th className="px-5 py-3">Host / cơ sở</th><th className="px-5 py-3">Phòng / lưu trú</th><th className="px-5 py-3">Số phòng / khách</th><th className="px-5 py-3">Tổng tiền</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thanh toán</th><th className="px-5 py-3">Hành động</th>
            </tr></thead>
            <tbody>
              {bookings.map((booking) => <tr key={booking.id} className="border-t border-slate-200">
                <td className="px-5 py-4"><p className="font-semibold">{booking.code}</p><p>{booking.user.fullName}</p><p className="text-xs text-slate-500">{booking.user.email}</p></td>
                <td className="px-5 py-4"><p>{booking.room.property.host.fullName}</p><p className="text-slate-500">{booking.room.property.name}</p></td>
                <td className="px-5 py-4"><p>{booking.room.name} · {booking.room.type}</p><p className="text-slate-500">{date(booking.checkIn)} – {date(booking.checkOut)}</p></td>
                <td className="px-5 py-4">{booking.roomCount} phòng · {booking.guestCount} khách</td>
                <td className="px-5 py-4 font-semibold">{money(booking.totalPrice)}</td>
                <td className="px-5 py-4">{statusNames[booking.status] ?? booking.status}</td>
                <td className="px-5 py-4">{booking.paymentStatus}</td>
                <td className="px-5 py-4">{booking.status === 'CONFIRMED' && <button onClick={() => void cancelBooking(booking.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">Hủy booking</button>}</td>
              </tr>)}
              {bookings.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">Không có booking phù hợp bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black text-slate-900">Đơn đăng ký Host</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Người đăng ký</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Liên hệ</th><th className="px-5 py-3">Lý do</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Hành động</th></tr></thead>
            <tbody>
              {applications.map((application) => <tr key={application.id} className="border-t border-slate-200">
                <td className="px-5 py-4"><p className="font-semibold">{application.fullName}</p><p className="text-slate-500">CCCD: {application.cccd ?? '—'}</p></td>
                <td className="px-5 py-4 text-slate-600">{application.user.email}</td>
                <td className="px-5 py-4 text-slate-600"><p>{application.phone ?? '—'}</p><p>{application.address ?? '—'}</p></td>
                <td className="max-w-xs px-5 py-4 text-slate-600">{application.reason ?? '—'}</td>
                <td className="px-5 py-4">{application.status}</td>
                <td className="px-5 py-4">{application.status === 'PENDING' ? <div className="flex gap-2"><button onClick={() => void handleDecision(application.id, 'APPROVED')} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">Duyệt</button><button onClick={() => void handleDecision(application.id, 'REJECTED')} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">Từ chối</button></div> : <span className="text-slate-400">Đã xử lý</span>}</td>
              </tr>)}
              {applications.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Chưa có đơn đăng ký nào.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-2xl font-black text-slate-900">{value}</p><p className="mt-2 text-sm text-slate-600">{label}</p></div>;
}
