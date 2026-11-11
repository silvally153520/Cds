import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

type RoomOption = { id: string; name: string; property: { id: string; name: string } };
type CalendarDay = { date: string; status: string; bookedRooms: number; remainingRooms: number };

const dateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

export function HostCalendarPage() {
  const [search] = useSearchParams();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceKinds, setPriceKinds] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [priceKind, setPriceKind] = useState('CUSTOM');
  const [holidayPrice, setHolidayPrice] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/host/properties').then(({ data }) => {
      const options: RoomOption[] = data.flatMap((property: any) => property.rooms.map((room: any) => ({ id: room.id, name: room.name, property: { id: property.id, name: property.name } })));
      setRooms(options);
      const wantedProperty = search.get('propertyId');
      setRoomId(options.find((room) => room.property.id === wantedProperty)?.id ?? options[0]?.id ?? '');
    }).catch((err) => setError(err?.response?.data?.message ?? 'Không thể tải loại phòng.'));
  }, [search]);

  useEffect(() => {
    if (!roomId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError('');
    const from = dateKey(month.getFullYear(), month.getMonth(), 1);
    const to = dateKey(month.getFullYear(), month.getMonth(), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
    Promise.all([
      api.get(`/host/room-types/${roomId}/availability`, { params: { from, to } }),
      api.get(`/host/room-types/${roomId}/pricing`, { params: { from, to } }),
    ]).then(([availability, pricing]) => {
      if (!active) return;
      setDays(availability.data.days);
      setPrices(Object.fromEntries(pricing.data.prices.map((item: { date: string; price: number }) => [item.date, item.price])));
      setPriceKinds(Object.fromEntries(pricing.data.prices.map((item: { date: string; kind: string }) => [item.date, item.kind])));
      setHolidayPrice(pricing.data.holidayPrice);
    }).catch((err) => {
      if (active) setError(err?.response?.data?.message ?? 'Không thể tải lịch phòng.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, roomId]);

  const daysByDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const firstOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const numberOfDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const updateAvailability = async (status: 'OPEN' | 'CLOSED' | 'MAINTENANCE') => {
    if (!selectedDate || !roomId) return;
    try {
      await api.put(`/host/room-types/${roomId}/availability`, { date: selectedDate, status });
      setNotice(status === 'OPEN' ? 'Đã mở lại ngày được chọn.' : status === 'CLOSED' ? 'Đã đóng phòng trong ngày được chọn.' : 'Đã đánh dấu phòng bảo trì.');
      setError('');
      await reloadCalendar();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể cập nhật lịch phòng.');
    }
  };

  const updatePrice = async () => {
    if (!selectedDate || !roomId) return;
    const price = priceKind === 'HOLIDAY' ? null : priceInput.trim() ? Number(priceInput) : null;
    if (priceKind === 'HOLIDAY' && holidayPrice === null) {
      setError('Hãy thiết lập giá ngày lễ tại bước Loại phòng trước.');
      return;
    }
    if (price !== null && (!Number.isFinite(price) || price < 1000)) {
      setError('Giá theo ngày phải từ 1.000 VNĐ trở lên.');
      return;
    }
    try {
      const response = await api.put(`/host/room-types/${roomId}/pricing`, { date: selectedDate, price, kind: priceKind });
      setPrices((current) => {
        const next = { ...current };
        if (price === null && priceKind === 'CUSTOM') delete next[selectedDate];
        else next[selectedDate] = Number(response.data.price);
        return next;
      });
      setPriceKinds((current) => {
        const next = { ...current };
        if (price === null && priceKind === 'CUSTOM') delete next[selectedDate];
        else next[selectedDate] = priceKind;
        return next;
      });
      setNotice(price === null && priceKind === 'CUSTOM' ? 'Đã bỏ giá riêng cho ngày này.' : 'Đã lưu giá cho ngày này.');
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể cập nhật giá ngày.');
    }
  };

  const reloadCalendar = async () => {
    if (!roomId) return;
    const from = dateKey(month.getFullYear(), month.getMonth(), 1);
    const to = dateKey(month.getFullYear(), month.getMonth(), numberOfDays);
    const response = await api.get(`/host/room-types/${roomId}/availability`, { params: { from, to } });
    setDays(response.data.days);
  };

  const selected = daysByDate.get(selectedDate);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-7"><p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Quản lý của Host</p><h1 className="mt-2 text-3xl font-black text-slate-950">Lịch phòng và giá</h1><p className="mt-2 text-slate-600">Ngày đóng hoặc bảo trì sẽ không nhận booking mới. Tồn kho được đối chiếu với booking hiện tại.</p></header>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <select aria-label="Chọn loại phòng" value={roomId} onChange={(event) => { setRoomId(event.target.value); setSelectedDate(''); }} className="min-w-60 rounded-xl border border-slate-200 px-3 py-2.5">
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.property.name} · {room.name}</option>)}
            </select>
            <div className="flex items-center gap-2"><button aria-label="Tháng trước" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="rounded-full border px-3 py-2">←</button><span className="min-w-32 text-center font-bold">{monthNames[month.getMonth()]} {month.getFullYear()}</span><button aria-label="Tháng sau" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="rounded-full border px-3 py-2">→</button></div>
          </div>
          {rooms.length === 0 && !loading ? <p className="py-16 text-center text-slate-500">Chưa có loại phòng để quản lý lịch.</p> : <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <div key={day} className="py-2 text-center text-xs font-bold text-slate-500">{day}</div>)}
            {Array.from({ length: firstOffset }, (_, index) => <div key={`empty-${index}`} />)}
            {Array.from({ length: numberOfDays }, (_, index) => {
              const date = dateKey(month.getFullYear(), month.getMonth(), index + 1);
              const entry = daysByDate.get(date);
              const active = selectedDate === date;
              return <button key={date} onClick={() => { setSelectedDate(date); setPriceKind(priceKinds[date] ?? 'CUSTOM'); setPriceInput(priceKinds[date] === 'HOLIDAY' ? '' : prices[date]?.toString() ?? ''); setNotice(''); }} className={`min-h-[90px] rounded-xl border p-2 text-left transition sm:min-h-[110px] ${active ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-100 hover:border-emerald-300'} ${entry?.status === 'CLOSED' ? 'bg-red-50' : entry?.status === 'MAINTENANCE' ? 'bg-amber-50' : 'bg-white'}`}>
                <span className="text-sm font-bold text-slate-900">{index + 1}</span>
                <span className="mt-2 block text-[10px] font-semibold text-slate-500 sm:text-xs">{entry ? `Còn ${entry.remainingRooms} / ${entry.bookedRooms} đặt` : loading ? '…' : ''}</span>
                {prices[date] &&                 <span className="mt-1 block truncate text-[10px] text-emerald-800">{prices[date].toLocaleString('vi-VN')} ₫{priceKinds[date] === 'HOLIDAY' ? ' · Lễ' : ''}</span>}
                {entry?.status !== 'OPEN' && <span className="mt-1 block text-[10px] font-bold text-red-700">{entry?.status === 'CLOSED' ? 'Đã đóng' : entry?.status === 'MAINTENANCE' ? 'Bảo trì' : ''}</span>}
              </button>;
            })}
          </div>}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600"><span><i className="mr-1 inline-block h-3 w-3 rounded bg-white ring-1 ring-slate-300" />Mở bán</span><span><i className="mr-1 inline-block h-3 w-3 rounded bg-red-100" />Đã đóng</span><span><i className="mr-1 inline-block h-3 w-3 rounded bg-amber-100" />Bảo trì</span></div>
        </div>
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">{selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('vi-VN') : 'Chọn ngày'}</h2>
          {selected ? <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><p>Đã đặt: <strong>{selected.bookedRooms}</strong></p><p>Còn trống: <strong>{selected.remainingRooms}</strong></p><p>Trạng thái: <strong>{selected.status}</strong></p></div>
            <div><p className="mb-2 text-sm font-bold text-slate-800">Tình trạng phòng</p><div className="grid gap-2"><button onClick={() => void updateAvailability('OPEN')} className="rounded-xl border px-3 py-2 text-sm font-semibold">Mở lại</button><button onClick={() => void updateAvailability('CLOSED')} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Đóng phòng</button><button onClick={() => void updateAvailability('MAINTENANCE')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Bảo trì</button></div></div>
            <div><label className="mb-2 block text-sm font-bold text-slate-800">Áp dụng giá</label><select value={priceKind} onChange={(event) => setPriceKind(event.target.value)} className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="CUSTOM">Giá riêng cho ngày</option><option value="HOLIDAY">Giá ngày lễ {holidayPrice === null ? '(chưa thiết lập)' : `(${holidayPrice.toLocaleString('vi-VN')} ₫)`}</option></select><input type="number" min="1000" disabled={priceKind === 'HOLIDAY'} value={priceInput} onChange={(event) => setPriceInput(event.target.value)} placeholder={priceKind === 'HOLIDAY' ? 'Dùng giá ngày lễ của loại phòng' : 'Để trống dùng giá thường/cuối tuần'} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 disabled:bg-slate-50" /><button onClick={() => void updatePrice()} className="mt-2 w-full rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white">Lưu giá ngày</button></div>
          </div> : <p className="mt-3 text-sm text-slate-500">Chọn một ngày trên lịch để xem tồn kho, đóng/mở phòng hoặc đặt giá riêng.</p>}
        </aside>
      </section>
    </div>
  );
}
