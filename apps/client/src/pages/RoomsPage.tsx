import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { MapPin, RotateCw, SlidersHorizontal, Star, Users } from 'lucide-react';
import { api } from '../lib/api';
import { getCityLabel, normalizePropertyLocation } from '../lib/location';
import { propertyCategories, propertyTypeLabels } from '../lib/propertyCategories';

type RoomApi = {
  id: string;
  name: string;
  type: string;
  basePrice: number;
  maxGuests: number;
  images: string[];
  amenities: string[];
  rating?: number | null;
  reviewCount?: number;
  property: { id?: string; name: string; city: string | null; district: string; address: string; type: string };
};

type ExploreFilters = {
  q: string;
  city: string;
  category: string;
  maxGuests: string;
  minPrice: string;
  maxPrice: string;
  amenities: string;
  sort: string;
};

const defaultFilters: ExploreFilters = {
  q: '',
  city: '',
  category: '',
  maxGuests: '',
  minPrice: '',
  maxPrice: '',
  amenities: '',
  sort: 'popular',
};

function filtersFromParams(params: URLSearchParams): ExploreFilters {
  return {
    q: params.get('q') ?? '',
    city: params.get('city') ?? '',
    category: params.get('category') ?? params.get('type') ?? '',
    maxGuests: params.get('maxGuests') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    amenities: params.get('amenities') ?? '',
    sort: params.get('sort') ?? 'popular',
  };
}

function categoryHeading(category: string) {
  switch (category) {
    case 'HOTEL': return 'Khám phá khách sạn';
    case 'RESORT': return 'Khám phá resort nghỉ dưỡng';
    case 'VILLA': return 'Khám phá biệt thự';
    case 'HOMESTAY': return 'Khám phá homestay';
    case 'APARTMENT': return 'Khám phá căn hộ';
    case 'MOTEL': return 'Khám phá nhà nghỉ';
    default: return 'Khám phá phòng nghỉ phù hợp';
  }
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Không thể tải dữ liệu chỗ nghỉ. Vui lòng kiểm tra kết nối và thử lại.';
}

function normalizeRoom(value: unknown): RoomApi | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const room = value as Record<string, unknown>;
  if (typeof room.id !== 'string' || typeof room.name !== 'string') return null;
  const basePrice = Number(room.basePrice);
  if (!Number.isFinite(basePrice) || basePrice < 0) return null;
  return {
    id: room.id,
    name: room.name,
    type: typeof room.type === 'string' ? room.type : '',
    basePrice,
    maxGuests: Number.isFinite(Number(room.maxGuests)) ? Number(room.maxGuests) : 0,
    images: Array.isArray(room.images) ? room.images.filter((image): image is string => typeof image === 'string') : [],
    amenities: Array.isArray(room.amenities) ? room.amenities.filter((amenity): amenity is string => typeof amenity === 'string') : [],
    rating: typeof room.rating === 'number' ? room.rating : null,
    reviewCount: typeof room.reviewCount === 'number' ? room.reviewCount : 0,
    property: normalizePropertyLocation(room.property),
  };
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<RoomApi[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const [loadedKey, setLoadedKey] = useState('');
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);

  const category = searchParams.get('category') ?? searchParams.get('type') ?? '';
  const categoryName = category ? propertyTypeLabels[category] : '';
  const title = categoryHeading(category);
  const requestKey = JSON.stringify({ filters, retry });
  const loading = loadedKey !== requestKey;
  const error = errorState?.key === requestKey ? errorState.message : '';

  useEffect(() => {
    const params: Record<string, string | number | undefined> = {
      q: filters.q || undefined,
      city: filters.city || undefined,
      category: filters.category || undefined,
      maxGuests: filters.maxGuests ? Number(filters.maxGuests) : undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      amenities: filters.amenities || undefined,
      sort: filters.sort === 'popular' ? undefined : filters.sort,
    };
    let active = true;
    api.get<unknown>('/rooms', { params })
      .then(({ data }) => {
        if (active) {
          if (!Array.isArray(data)) throw new Error('Dữ liệu danh sách phòng từ máy chủ không đúng định dạng.');
          const normalizedRooms = data.map(normalizeRoom);
          if (normalizedRooms.some((room) => room === null)) throw new Error('Một số dữ liệu phòng từ máy chủ không hợp lệ.');
          setRooms(normalizedRooms);
          setLoadedKey(requestKey);
          setErrorState(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setRooms([]);
          setErrorState({ key: requestKey, message: getErrorMessage(requestError) });
          setLoadedKey(requestKey);
        }
      });
    return () => { active = false; };
  }, [filters, requestKey]);

  useEffect(() => {
    if (!category && location.pathname !== '/explore') return;
    requestAnimationFrame(() => document.getElementById('explore-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [category, location.pathname]);

  const updateFilters = (next: ExploreFilters) => {
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    if (next.city) params.set('city', next.city);
    if (next.category) params.set('category', next.category);
    if (next.maxGuests) params.set('maxGuests', next.maxGuests);
    if (next.minPrice) params.set('minPrice', next.minPrice);
    if (next.maxPrice) params.set('maxPrice', next.maxPrice);
    if (next.amenities) params.set('amenities', next.amenities);
    if (next.sort && next.sort !== 'popular') params.set('sort', next.sort);
    setSearchParams(params, { replace: true, preventScrollReset: true });
  };

  const resetFilters = () => updateFilters(defaultFilters);
  const applyCategory = (categoryValue: string) => updateFilters({ ...filters, category: categoryValue });
  const sortedRooms = rooms;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-slate-800 to-emerald-800 px-6 py-8 text-white shadow-lg sm:px-9 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">Khám phá chỗ nghỉ</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">Tìm nơi lưu trú phù hợp từ các cơ sở đang hoạt động và được duyệt trên Sieuechxanh.</p>
      </section>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{categoryName ? `Chỗ nghỉ: ${categoryName}` : 'Tất cả chỗ nghỉ'}</h2>
          <p aria-live="polite" className="mt-1 text-sm text-slate-500">{loading ? 'Đang tìm kiếm...' : `${rooms.length} kết quả`}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <span className="hidden sm:inline">Sắp xếp:</span>
          <select value={filters.sort} onChange={(event) => updateFilters({ ...filters, sort: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500">
            <option value="popular">Phổ biến</option>
            <option value="price_asc">Giá tăng dần</option>
            <option value="price_desc">Giá giảm dần</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><SlidersHorizontal className="h-5 w-5 text-emerald-700" />Bộ lọc</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Tên chỗ nghỉ hoặc địa điểm
              <input value={filters.q} onChange={(event) => updateFilters({ ...filters, q: event.target.value })} placeholder="Tên, thành phố, địa chỉ..." className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Thành phố
              <input value={filters.city} onChange={(event) => updateFilters({ ...filters, city: event.target.value })} placeholder="Đà Nẵng, Đà Lạt..." className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Loại hình
              <select value={filters.category} onChange={(event) => applyCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500">
                {propertyCategories.map((item) => <option key={item.value || 'all'} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Số khách tối thiểu
              <input type="number" min={1} max={100} value={filters.maxGuests} onChange={(event) => updateFilters({ ...filters, maxGuests: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500" />
            </label>
            <div>
              <span className="block text-sm font-semibold text-slate-700">Giá mỗi đêm (VND)</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="number" min={0} value={filters.minPrice} onChange={(event) => updateFilters({ ...filters, minPrice: event.target.value })} placeholder="Từ" aria-label="Giá thấp nhất" className="min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                <input type="number" min={0} value={filters.maxPrice} onChange={(event) => updateFilters({ ...filters, maxPrice: event.target.value })} placeholder="Đến" aria-label="Giá cao nhất" className="min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
              </div>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Tiện nghi
              <input value={filters.amenities} onChange={(event) => updateFilters({ ...filters, amenities: event.target.value })} placeholder="Wi-Fi, Hồ bơi (phân cách dấu phẩy)" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500" />
            </label>
            <button type="button" onClick={resetFilters} className="w-full rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">Xóa bộ lọc</button>
          </div>
        </aside>

        <section id="explore-results" aria-label="Kết quả chỗ nghỉ" className="scroll-mt-40">
          {error ? (
            <div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="font-semibold text-red-800">{error}</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-red-700 shadow-sm"><RotateCw className="h-4 w-4" />Thử lại</button>
            </div>
          ) : loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-3xl border border-slate-100 bg-white"><div className="h-52 bg-slate-200" /><div className="space-y-3 p-5"><div className="h-4 w-1/3 rounded bg-slate-200" /><div className="h-5 w-3/4 rounded bg-slate-200" /><div className="h-4 w-1/2 rounded bg-slate-100" /></div></div>)}
            </div>
          ) : sortedRooms.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {sortedRooms.map((room) => (
                <article key={room.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <Link to={`/rooms/${room.id}`} className="block">
                    <div className="relative overflow-hidden">
                      {room.images?.[0]
                        ? <img src={room.images[0]} alt={room.name} className="h-52 w-full object-cover transition duration-500 group-hover:scale-105" />
                        : <div className="flex h-52 items-center justify-center bg-emerald-50 text-sm font-medium text-emerald-700">Ảnh chưa được cung cấp</div>}
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-emerald-800">{propertyTypeLabels[room.property.type] ?? room.property.type}</span>
                    </div>
                    <div className="space-y-3 p-5">
                      <div><h3 className="line-clamp-1 text-lg font-extrabold text-slate-900">{room.property.name}</h3><p className="mt-1 line-clamp-1 text-sm text-slate-600">{room.name}</p></div>
                      <p className="flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4 shrink-0 text-emerald-600" />{room.property.district ? `${room.property.district}, ` : ''}{getCityLabel(room.property.city)}</p>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-4 w-4" />Tối đa {room.maxGuests} khách</span>
                        <span className="text-right"><strong className="block text-base font-black text-slate-900">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(room.basePrice)}</strong><small className="text-xs text-slate-500">mỗi đêm</small></span>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {typeof room.rating === 'number' && room.reviewCount
                          ? `${room.rating.toFixed(1)} (${room.reviewCount} đánh giá)`
                          : 'Chưa có đánh giá'}
                      </p>
                      {room.amenities.length > 0 && <p className="line-clamp-1 text-xs text-slate-500">{room.amenities.join(' · ')}</p>}
                    </div>
                  </Link>
                  <div className="px-5 pb-5"><Link to={`/rooms/${room.id}`} className="block rounded-full bg-slate-900 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-emerald-700">Xem chi tiết</Link></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <h3 className="text-lg font-bold text-slate-900">Không tìm thấy cơ sở lưu trú</h3>
              <p className="mt-2 text-sm text-slate-500">Thử thay đổi danh mục hoặc điều kiện lọc để xem thêm kết quả.</p>
              <button type="button" onClick={resetFilters} className="mt-5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">Xem tất cả</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
