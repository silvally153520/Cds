import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { BedDouble, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api, setAuthSession } from '../lib/api';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

const registerSchema = z.object({
  fullName: z.string().min(3, 'Họ tên tối thiểu 3 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ'),
});

export function AuthPage() {
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', phone: '' },
  });

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoginError('');
    setLoginSuccess('');

    try {
      const response = await api.post('/auth/login', values);
      const { token, user } = response.data;
      setAuthSession(token, user);
      setLoginSuccess('Đăng nhập thành công.');
      window.location.href = '/';
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Đăng nhập thất bại.';
      setLoginError(message);
    }
  };

  const handleRegister = async (values: { fullName: string; email: string; password: string; phone: string }) => {
    setRegisterError('');

    try {
      const response = await api.post('/auth/register', values);
      const { token, user } = response.data;
      setAuthSession(token, user);
      window.location.href = '/';
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Đăng ký thất bại.';
      setRegisterError(message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <span className="section-tag">Xác thực</span>
        <h1 className="mt-3 text-4xl font-black text-slate-900">Mở tài khoản hoặc đăng nhập</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[32px] bg-gradient-to-br from-emerald-600 via-green-500 to-teal-500 p-8 text-white shadow-emerald">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <BedDouble className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-black">Chào mừng bạn đến Sieuechxanh</h2>
          <p className="mt-4 text-sm leading-7 text-emerald-50/90">
            Khám phá nơi ở đẹp, ưu đãi tốt và trải nghiệm đặt phòng nhanh chóng với bảo mật cao.
          </p>

          <div className="mt-8 space-y-4 text-sm text-emerald-50/90">
            {[
              'Tìm phòng phù hợp trong vài phút',
              'Đặt phòng an toàn và minh bạch',
              'Dễ dàng quản lý lưu trú cho thuê',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-white" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm backdrop-blur-sm">
            <ShieldCheck className="h-5 w-5 text-white" />
            <span>Thanh toán và tài khoản được bảo vệ</span>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="text-2xl font-black text-slate-900">Đăng nhập</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input {...loginForm.register('email')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" placeholder="you@example.com" />
                {loginForm.formState.errors.email && <p className="mt-2 text-sm text-red-500">{loginForm.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Mật khẩu</label>
                <input type="password" {...loginForm.register('password')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" placeholder="••••••••" />
                {loginForm.formState.errors.password && <p className="mt-2 text-sm text-red-500">{loginForm.formState.errors.password.message}</p>}
              </div>
            </div>
            {loginError && <p className="mt-4 text-sm text-red-500">{loginError}</p>}
            {loginSuccess && <p className="mt-4 text-sm text-emerald-600">{loginSuccess}</p>}
            <button type="submit" className="mt-6 w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Đăng nhập
            </button>
          </form>

          <form id="register" onSubmit={registerForm.handleSubmit(handleRegister)} className="scroll-mt-32 rounded-[32px] border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="text-2xl font-black text-slate-900">Tạo tài khoản</h2>
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Họ tên</label>
                <input {...registerForm.register('fullName')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" placeholder="Nguyễn Văn A" />
                {registerForm.formState.errors.fullName && <p className="mt-2 text-sm text-red-500">{registerForm.formState.errors.fullName.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input {...registerForm.register('email')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" placeholder="you@example.com" />
                {registerForm.formState.errors.email && <p className="mt-2 text-sm text-red-500">{registerForm.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Số điện thoại</label>
                <input {...registerForm.register('phone')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" placeholder="0901 234 567" />
                {registerForm.formState.errors.phone && <p className="mt-2 text-sm text-red-500">{registerForm.formState.errors.phone.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Mật khẩu</label>
                <input type="password" {...registerForm.register('password')} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" placeholder="••••••••" />
                {registerForm.formState.errors.password && <p className="mt-2 text-sm text-red-500">{registerForm.formState.errors.password.message}</p>}
              </div>
            </div>
            {registerError && <p className="mt-4 text-sm text-red-500">{registerError}</p>}
            <button type="submit" className="mt-6 w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
              Đăng ký tài khoản
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
