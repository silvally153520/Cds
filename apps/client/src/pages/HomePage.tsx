import { ArrowRight, MapPin, Users, CalendarDays, BedDouble, Building2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { propertyTypeLabels } from '../lib/propertyCategories';

type ApiRoom = {
  id: string;
  name: string;
  type: string;
  basePrice: number;
  maxGuests: number;
  images: string[];
  property: { name: string; city: string; district: string; address: string; type: string };
  host: { id: string; fullName: string };
};

export function HomePage() {
  const [featuredRooms, setFeaturedRooms] = useState<ApiRoom[]>([]);
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [searchParams] = useSearchParams();
  const selectedType = searchParams.get('category') ?? searchParams.get('type') ?? '';
  const categoryLabel = propertyTypeLabels[selectedType]?.toLocaleLowerCase('vi') ?? '';
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setRoomsLoading(true);
    setRoomsError('');
    api
      .get('/rooms', { params: { category: selectedType || undefined } })
      .then((response) => {
        if (active) setFeaturedRooms(response.data);
      })
      .catch((error) => {
        if (!active) return;
        setFeaturedRooms([]);
        setRoomsError(error?.response?.data?.message ?? 'Không thể tải danh sách chỗ nghỉ.');
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => { active = false; };
  }, [selectedType]);

  const destinations = useMemo(() => {
    const map = new Map<string, number>();
    for (const room of featuredRooms) {
      map.set(room.property.city, (map.get(room.property.city) ?? 0) + 1);
    }
    return Array.from(map.entries()).slice(0, 3).map(([cityName, count]) => ({
      city: cityName,
      count: `${count} phòng đang có sẵn`,
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    }));
  }, [featuredRooms]);

  const handleQuickSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (selectedType) params.set('category', selectedType);
    navigate(`/explore${params.size ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[36px] bg-gradient-to-br from-emerald-600 via-green-500 to-teal-500 p-6 text-white shadow-emerald md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-emerald-50">
              Sieuechxanh • stay better
            </div>
            <h1 className="max-w-xl text-4xl font-black tracking-tight md:text-6xl">
              Tìm chỗ nghỉ phù hợp cho mọi hành trình.
            </h1>
            <p className="mt-5 max-w-xl text-base text-emerald-50/90 md:text-lg">
              Khám phá hàng trăm phòng nghỉ chất lượng với giá minh bạch, dịch vụ tận tâm và trải nghiệm đặt phòng dễ dàng.
            </p>

            <form onSubmit={handleQuickSearch} className="mt-8 grid gap-4 rounded-[28px] border border-white/20 bg-slate-950/10 p-4 backdrop-blur-sm md:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Địa điểm</label>
                <input value={city} onChange={(event) => setCity(event.target.value)} className="w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-emerald-50/70 outline-none ring-0" placeholder="Vũng Tàu" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Nhận phòng</label>
                <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Trả phòng</label>
                <input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-semibold text-emerald-600 transition hover:bg-emerald-50">
                  Tìm phòng <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-[28px] bg-white/10 p-4 backdrop-blur-sm">
            <img
              src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80"
              alt="Luxury resort"
              className="h-[420px] w-full rounded-[24px] object-cover"
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-emerald-50/80">Loại hình lưu trú</p>
                <div className="mt-2 flex items-center gap-2 text-2xl font-black"><Building2 className="h-5 w-5" /> {new Set(featuredRooms.map((room) => room.property.type)).size}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-emerald-50/80">Phòng đang mở</p>
                <div className="mt-2 flex items-center gap-2 text-2xl font-black"><BedDouble className="h-5 w-5" /> {featuredRooms.length}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-4">
        {[
          { label: 'Tổng số phòng', value: String(featuredRooms.length || 0) },
          { label: 'Địa điểm đang mở', value: String(new Set(featuredRooms.map((room) => room.property.city)).size || 0) },
          { label: 'Loại hình lưu trú', value: String(new Set(featuredRooms.map((room) => room.property.type)).size) },
          { label: 'Host đồng hành', value: String(new Set(featuredRooms.map((room) => room.host.fullName)).size || 0) },
        ].map((item) => (
          <div key={item.label} className="luxury-card p-6">
            <p className="text-3xl font-black text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm text-slate-600">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="section-tag">{categoryLabel || 'Phòng nổi bật'}</span>
            <h2 className="mt-3 text-3xl font-black text-slate-900">{categoryLabel ? `Chỗ nghỉ ${categoryLabel} nổi bật` : 'Lựa chọn được yêu thích nhất'}</h2>
          </div>
          <Link to={`/explore${selectedType ? `?category=${encodeURIComponent(selectedType)}` : ''}`} className="hidden items-center gap-2 text-sm font-semibold text-emerald-600 md:inline-flex">
            Xem tất cả <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {featuredRooms.length > 0 ? featuredRooms.slice(0, 4).map((room) => (
            <article key={room.id} className="group overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-emerald">
              <div className="relative overflow-hidden">
                <img src={room.images?.[0] ?? 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'} alt={room.name} className="h-60 w-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">{room.type}</span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{propertyTypeLabels[room.property.type] ?? room.property.type}</span>
                  <span className="text-xs font-medium text-slate-500">{room.type}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{room.name}</h3>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4 text-emerald-500" /> {room.property.city}</div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /> {room.maxGuests} khách</span>
                  <span className="font-semibold text-right text-slate-900">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(room.basePrice)}
                    <span className="ml-1 text-xs text-slate-500">/đêm</span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <span className="text-sm text-slate-500">Host: {room.host.fullName}</span>
                  <Link to={`/rooms/${room.id}`} className="rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    Đặt ngay
                  </Link>
                </div>
              </div>
            </article>
          )) : roomsLoading ? (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
              Đang tải phòng nổi bật...
            </div>
          ) : (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
              {roomsError || (selectedType ? 'Chưa có chỗ nghỉ nào thuộc danh mục này.' : 'Chưa có chỗ nghỉ nào để hiển thị.')}
            </div>
          )}
        </div>
      </section>

      <section className="mt-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="section-tag">Điểm đến hot</span>
            <h2 className="mt-3 text-3xl font-black text-slate-900">Khám phá nơi bạn muốn đến</h2>
          </div>
          <Link to="/explore" className="hidden items-center gap-2 text-sm font-semibold text-emerald-600 md:inline-flex">
            Tất cả địa điểm <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {destinations.length > 0 ? destinations.map((destination) => (
            <Link key={destination.city} to={`/explore?city=${encodeURIComponent(destination.city)}`} className="group relative overflow-hidden rounded-[28px] border border-white/20 shadow-soft">
              <img src={destination.image} alt={destination.city} className="h-80 w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex items-center gap-2 text-sm text-emerald-100"><CalendarDays className="h-4 w-4" /> {destination.count}</div>
                <h3 className="mt-2 text-2xl font-black">{destination.city}</h3>
              </div>
            </Link>
          )) : (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
              Chưa có điểm đến nào được tải.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
