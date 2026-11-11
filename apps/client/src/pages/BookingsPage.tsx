import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Booking = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  roomCount: number;
  room: {
    name: string;
    type: string;
    basePrice: number;
    property: { name: string; city: string };
  };
  checkIn: string;
  checkOut: string;
  createdAt: string;
};

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [now] = useState(() => Date.now());

  const loadBookings = useCallback(async () => {
    try {
      const response = await api.get('/bookings/my');
      setBookings(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể tải lịch sử đặt phòng.');
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const handleCancel = async (bookingId: string) => {
    try {
      await api.patch(`/bookings/${bookingId}/cancel`);
      await loadBookings();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể hủy đơn.');
    }
  };

  const canCancel = (booking: Booking) => booking.status === 'CONFIRMED'
    && new Date(booking.checkIn).getTime() - now >= 48 * 60 * 60 * 1000;
  const statusLabel: Record<string, string> = {
    CONFIRMED: 'Đã xác nhận',
    CHECKED_IN: 'Đã nhận phòng',
    CHECKED_OUT: 'Đã trả phòng',
    CANCELLED: 'Đã hủy',
    COMPLETED: 'Hoàn tất',
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Đơn đặt phòng</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900">Đơn đặt phòng của tôi</h1>
        </div>
      </div>

      {error && <p className="mb-6 text-sm text-red-500">{error}</p>}

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3">Mã đơn</th>
                <th className="px-5 py-3">Phòng</th>
                <th className="px-5 py-3">Ngày</th>
                <th className="px-5 py-3">Tổng tiền</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Thanh toán</th>
                <th className="px-5 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    Bạn chưa đặt phòng nào.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-slate-200">
                    <td className="px-5 py-4 font-semibold text-slate-900">{booking.code}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{booking.room.name}</p>
                      <p className="text-slate-500">{booking.room.type} · {booking.roomCount} phòng</p>
                      <p className="text-xs text-slate-400">{booking.room.property.name}, {booking.room.property.city}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p>{new Date(booking.checkIn).toLocaleDateString('vi-VN')}</p>
                      <p>{new Date(booking.checkOut).toLocaleDateString('vi-VN')}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(booking.totalPrice)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN' ? 'bg-emerald-50 text-emerald-700' : booking.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                        {statusLabel[booking.status] ?? booking.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{booking.paymentStatus}</td>
                    <td className="px-5 py-4">
                      {canCancel(booking) && (
                        <button onClick={() => handleCancel(booking.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                          Hủy trước 48 giờ
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
