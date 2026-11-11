import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { api, getStoredUser } from '../lib/api';
import { propertyTypeLabels } from '../lib/propertyCategories';

const bookingSchema = z.object({
  checkIn: z.string().min(1, 'Chọn ngày nhận phòng'),
  checkOut: z.string().min(1, 'Chọn ngày trả phòng'),
  guestCount: z.coerce.number().min(1).max(12),
  roomCount: z.coerce.number().min(1).max(10),
});

type RoomDetail = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  maxGuests: number;
  images: string[];
  amenities: string[];
  status: string;
  property: {
    id: string;
    name: string;
    city: string;
    district: string;
    address: string;
    type: string;
    host: { id: string; fullName: string };
  };
};

export function RoomDetailPage() {
  const { id } = useParams();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availability, setAvailability] = useState<{ checkIn: string; checkOut: string; roomCount: number; availableRooms: number } | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [today] = useState(() => {
    const localDate = new Date();
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    return localDate.toISOString().slice(0, 10);
  });
  const user = getStoredUser();

  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      checkIn: '',
      checkOut: '',
      guestCount: 2,
      roomCount: 1,
    },
  });
  const [checkIn, checkOut, roomCount] = useWatch({
    control: form.control,
    name: ['checkIn', 'checkOut', 'roomCount'],
  });

  useEffect(() => {
    if (!id) return;

    api
      .get(`/rooms/${id}`)
      .then((response) => setRoom(response.data))
      .catch((err) => setError(err?.response?.data?.message ?? 'Không thể tải chi tiết phòng.'));
  }, [id]);

  useEffect(() => {
    if (!room || !checkIn || !checkOut || checkOut <= checkIn) return;
    let active = true;
    const timer = window.setTimeout(() => {
      api.get(`/bookings/availability/${room.id}`, { params: { checkIn, checkOut, roomCount } })
        .then((response) => {
          if (active) {
            setAvailability({ checkIn, checkOut, roomCount: Number(roomCount), availableRooms: response.data.availableRooms });
            setAvailabilityError('');
          }
        })
        .catch((err) => {
          if (active) setAvailabilityError(err?.response?.data?.message ?? 'Không kiểm tra được tình trạng phòng.');
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [room, checkIn, checkOut, roomCount]);

  const availableRooms = availability?.checkIn === checkIn && availability.checkOut === checkOut && availability.roomCount === Number(roomCount)
    ? availability.availableRooms
    : null;
  const nights = (() => {
    const start = checkIn;
    const end = checkOut;
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  })();

  const calculatedTotal = room ? room.basePrice * nights * Number(roomCount || 1) : 0;

  const onSubmit = async (values: { checkIn: string; checkOut: string; guestCount: number; roomCount: number }) => {
    if (!room) return;

    setError('');
    setSuccess('');

    try {
      if (!user) {
        setError('Bạn cần đăng nhập để đặt phòng.');
        return;
      }

      const response = await api.post('/bookings', {
        roomId: room.id,
        ...values,
      });

      setSuccess(`Đặt phòng thành công! Đơn ${response.data.code} đã được xác nhận ngay.`);
      form.reset();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể đặt phòng. Vui lòng thử lại.');
    }
  };

  if (!room) {
    return <div className="mx-auto max-w-6xl px-4 py-12 text-slate-600">{error || 'Đang tải...'}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <img src={room.images?.[0] ?? 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'} alt={room.name} className="h-[420px] w-full rounded-[28px] object-cover" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {room.images.slice(0, 3).map((image, index) => (
              <img key={index} src={image} alt={room.name} className="h-32 w-full rounded-2xl object-cover" />
            ))}
          </div>
          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-black text-slate-900">{room.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-500" /> {room.property.city}</span>
              <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-slate-500" /> Tối đa {room.maxGuests} khách</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{propertyTypeLabels[room.property.type] ?? room.property.type}</span>
            </div>
            <p className="mt-5 text-slate-600">{room.description}</p>
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-900">Tiện nghi</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {room.amenities.map((amenity) => (
                  <span key={amenity} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">{amenity}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-5">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-600">Giá phòng</p>
              <p className="mt-2 text-3xl font-black text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(room.basePrice)}
                <span className="ml-2 text-base font-medium text-slate-500">/đêm</span>
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">{room.status}</span>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Ngày nhận phòng</label>
              <input type="date" min={today} {...form.register('checkIn')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Ngày trả phòng</label>
              <input type="date" min={checkIn || today} {...form.register('checkOut')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Số khách</label>
                <input type="number" min={1} max={room.maxGuests * Number(roomCount || 1)} {...form.register('guestCount')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Số phòng</label>
                <input type="number" min={1} {...form.register('roomCount')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between"><span>Số đêm</span><span>{nights || 0}</span></div>
              <div className="mt-2 flex items-center justify-between"><span>Còn trống</span><span>{availableRooms === null ? (checkIn && checkOut ? (availabilityError ? 'Không khả dụng' : 'Đang kiểm tra…') : 'Chọn ngày để kiểm tra') : `${availableRooms} phòng`}</span></div>
              <div className="mt-2 flex items-center justify-between"><span>Tổng tiền</span><span className="font-bold text-slate-900">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculatedTotal)}</span></div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {availabilityError && <p className="text-sm text-amber-700">{availabilityError}</p>}
            {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success} <Link className="font-semibold underline" to="/bookings">Xem đơn của tôi</Link></div>}

            <button disabled={form.formState.isSubmitting || (availableRooms !== null && availableRooms < Number(roomCount || 1))} type="submit" className="w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              Đặt phòng ngay
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Host</p>
            <p className="mt-1">{room.property.host.fullName}</p>
            <div className="mt-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-500" /> {room.property.address}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
