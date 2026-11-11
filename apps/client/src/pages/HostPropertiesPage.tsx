import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Property = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  rejectionReason: string | null;
  address: string;
  city: string;
  district: string;
  images: string[];
  createdAt: string;
  rooms: { id: string; availableRooms: number }[];
};

const statusNames: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  PENDING_APPROVAL: 'Chờ duyệt',
  ACTIVE: 'Đã duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  INACTIVE: 'Đang ẩn',
};

export function HostPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 8;

  const loadProperties = async () => {
    setLoading(true);
    try {
      const response = await api.get('/host/properties');
      setProperties(response.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể tải danh sách cơ sở lưu trú.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProperties(); }, []);

  const filtered = useMemo(() => properties.filter((property) => (
    `${property.name} ${property.code ?? ''} ${property.city} ${property.district}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  )), [properties, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const hideProperty = async (property: Property) => {
    if (!window.confirm(`Ẩn cơ sở "${property.name}" khỏi trang khám phá?`)) return;
    try {
      await api.delete(`/host/properties/${property.id}`);
      await loadProperties();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể ẩn cơ sở lưu trú.');
    }
  };

  const submitAgain = async (property: Property) => {
    try {
      await api.post(`/host/properties/${property.id}/submit`);
      await loadProperties();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể gửi lại yêu cầu duyệt.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Quản lý của Host</p><h1 className="mt-2 text-3xl font-black text-slate-950">Cơ sở lưu trú của tôi</h1><p className="mt-2 text-slate-600">Theo dõi phòng, lịch và trạng thái kiểm duyệt.</p></div>
        <Link to="/host/properties/new" className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">+ Thêm cơ sở lưu trú</Link>
      </header>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-slate-800">{filtered.length} cơ sở</p>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm theo tên, mã, địa điểm…" aria-label="Tìm cơ sở lưu trú" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 sm:max-w-sm" />
        </div>
        {loading ? <p className="py-12 text-center text-slate-500">Đang tải dữ liệu…</p> : visible.length === 0 ? <div className="py-14 text-center"><p className="font-semibold text-slate-800">Chưa có cơ sở lưu trú phù hợp.</p><p className="mt-2 text-sm text-slate-500">Tạo cơ sở đầu tiên để bắt đầu quản lý phòng.</p></div> : (
          <div className="grid gap-4">
            {visible.map((property) => {
              const roomCount = property.rooms.reduce((sum, room) => sum + room.availableRooms, 0);
              const canSubmit = ['DRAFT', 'REJECTED', 'INACTIVE'].includes(property.status);
              return (
                <article key={property.id} className="grid gap-4 rounded-2xl border border-slate-100 p-4 md:grid-cols-[150px_1fr_auto] md:items-center">
                  {property.images[0] ? <img src={property.images[0]} alt={property.name} className="h-28 w-full rounded-xl object-cover md:w-[150px]" /> : <div className="flex h-28 items-center justify-center rounded-xl bg-emerald-50 text-sm text-emerald-800 md:w-[150px]">Chưa có ảnh</div>}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-950">{property.name}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${property.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : property.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{statusNames[property.status] ?? property.status}</span></div>
                    <p className="mt-1 text-sm text-slate-600">{property.code ?? '—'} · {property.type} · {property.district}, {property.city}</p>
                    <p className="mt-2 text-sm text-slate-500">{property.rooms.length} loại phòng · {roomCount} phòng thực tế · Tạo ngày {new Date(property.createdAt).toLocaleDateString('vi-VN')}</p>
                    {property.rejectionReason && <p className="mt-2 text-sm font-medium text-red-700">Lý do từ chối: {property.rejectionReason}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Link to={`/host/properties/${property.id}/edit`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Chi tiết / Sửa</Link>
                    <Link to={`/host/calendar?propertyId=${property.id}`} className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Lịch phòng</Link>
                    {canSubmit && <button onClick={() => void submitAgain(property)} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Gửi duyệt</button>}
                    {property.status === 'ACTIVE' && <button onClick={() => void hideProperty(property)} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Ẩn</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {pageCount > 1 && <div className="mt-6 flex items-center justify-center gap-3"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">Trước</button><span className="text-sm text-slate-600">Trang {page} / {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">Sau</button></div>}
      </section>
    </div>
  );
}
