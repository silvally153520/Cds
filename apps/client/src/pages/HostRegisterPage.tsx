import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { api, getStoredUser } from '../lib/api';

const hostSchema = z.object({
  fullName: z.string().min(3, 'Họ tên phải trên 3 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ'),
  address: z.string().min(5, 'Địa chỉ không được để trống'),
  cccd: z.string().min(9, 'CCCD không hợp lệ'),
  bio: z.string().min(10, 'Mô tả bản thân tối thiểu 10 ký tự'),
  reason: z.string().min(10, 'Lý do đăng ký phải rõ ràng hơn'),
});

export function HostRegisterPage() {
  const [user] = useState(() => getStoredUser());
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState<{ status: string; rejectionReason?: string | null } | null>(null);

  const form = useForm({
    resolver: zodResolver(hostSchema),
    defaultValues: { fullName: '', email: '', phone: '', address: '', cccd: '', bio: '', reason: '' },
  });
  const { reset } = form;

  useEffect(() => {
    if (!user) return;

    Promise.all([api.get('/host/application-status'), api.get('/auth/me')])
      .then(([applicationResponse, userResponse]) => {
        setStatus(applicationResponse.data?.application ?? null);
        const account = userResponse.data;
        reset({
          fullName: account.fullName ?? '',
          email: account.email ?? '',
          phone: account.phone ?? '',
          address: account.address ?? '',
          cccd: '',
          bio: '',
          reason: '',
        });
      })
      .catch((error: unknown) => setFormError(isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'Không thể tải trạng thái đăng ký Host.' : 'Không thể tải trạng thái đăng ký Host.'))
      .finally(() => setLoadingStatus(false));
  }, [user, reset]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (user.role === 'HOST') return <Navigate to="/host/dashboard" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;

  const onSubmit = async (values: z.infer<typeof hostSchema>) => {
    setFormError('');
    setSuccess('');

    try {
      const response = await api.post('/host/application', values);
      setStatus(response.data);
      setSuccess('Đơn đăng ký host đã được gửi thành công. Chúng tôi sẽ xét duyệt trong thời gian sớm nhất.');
      form.reset();
    } catch (error: any) {
      setFormError(isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'Không thể gửi đơn đăng ký host.' : 'Không thể gửi đơn đăng ký host.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Trở thành Host</p>
        <h1 className="mt-3 text-4xl font-black text-slate-900">Đăng ký trở thành chủ phòng nghỉ</h1>
      </div>

      {status && (
        <div className={`mb-6 rounded-2xl border p-4 text-sm ${status.status === 'REJECTED' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          Trạng thái đơn hiện tại: <span className="font-semibold">{status.status}</span>
          {status.status === 'REJECTED' && status.rejectionReason && <p className="mt-2">Lý do từ chối: {status.rejectionReason}</p>}
          {status.status === 'PENDING' && <p className="mt-2">Đơn đăng ký của bạn đang chờ Admin xét duyệt.</p>}
        </div>
      )}

      {loadingStatus && <p className="mb-4 text-center text-sm text-slate-500">Đang kiểm tra trạng thái đơn đăng ký...</p>}
      {!loadingStatus && status?.status !== 'PENDING' && <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Họ tên</label>
            <input {...form.register('fullName')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            {form.formState.errors.fullName && <p className="mt-2 text-sm text-red-500">{form.formState.errors.fullName.message}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input {...form.register('email')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            {form.formState.errors.email && <p className="mt-2 text-sm text-red-500">{form.formState.errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Số điện thoại</label>
            <input {...form.register('phone')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            {form.formState.errors.phone && <p className="mt-2 text-sm text-red-500">{form.formState.errors.phone.message}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">CCCD / Giấy tờ xác minh</label>
            <input {...form.register('cccd')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            {form.formState.errors.cccd && <p className="mt-2 text-sm text-red-500">{form.formState.errors.cccd.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Địa chỉ</label>
            <input {...form.register('address')} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            {form.formState.errors.address && <p className="mt-2 text-sm text-red-500">{form.formState.errors.address.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Mô tả bản thân</label>
            <textarea {...form.register('bio')} rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            {form.formState.errors.bio && <p className="mt-2 text-sm text-red-500">{form.formState.errors.bio.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Lý do muốn trở thành Host</label>
            <textarea {...form.register('reason')} rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
            {form.formState.errors.reason && <p className="mt-2 text-sm text-red-500">{form.formState.errors.reason.message}</p>}
          </div>
        </div>

        {formError && <p className="mt-4 text-sm text-red-500">{formError}</p>}
        {success && <p className="mt-4 text-sm text-emerald-600">{success}</p>}

        <button type="submit" disabled={form.formState.isSubmitting} className="mt-8 inline-flex rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600 disabled:opacity-60">
          {status?.status === 'REJECTED' ? 'Gửi lại đơn đăng ký' : 'Gửi đơn đăng ký'}
        </button>
      </form>}
    </div>
  );
}
