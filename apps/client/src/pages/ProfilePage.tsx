import { useEffect, useState, type FormEvent } from 'react';
import { Camera, LockKeyhole, Save, UserRound } from 'lucide-react';
import { isAxiosError } from 'axios';
import { api, getAuthToken, getStoredUser, setAuthSession } from '../lib/api';

type Profile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? fallback;
  return fallback;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<Profile>('/auth/me')
      .then(({ data }) => { if (active) setProfile(data); })
      .catch((error: unknown) => { if (active) setProfileError(getErrorMessage(error, 'Không thể tải thông tin hồ sơ.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError('');
    const formData = new FormData(event.currentTarget);
    try {
      const { data } = await api.patch<Profile>('/auth/profile', {
        fullName: formData.get('fullName'),
        phone: formData.get('phone') || null,
        address: formData.get('address') || null,
        avatarUrl: formData.get('avatarUrl') || '',
      });
      setProfile(data);
      const token = getAuthToken();
      if (token) setAuthSession(token, { ...getStoredUser(), ...data });
      setProfileMessage('Thông tin hồ sơ đã được cập nhật.');
    } catch (error) {
      setProfileError(getErrorMessage(error, 'Không thể cập nhật hồ sơ.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSavingPassword(true);
    setPasswordMessage('');
    setPasswordError('');
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get('currentPassword') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới cần ít nhất 6 ký tự.');
      setSavingPassword(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      setSavingPassword(false);
      return;
    }
    try {
      const { data } = await api.patch<{ message: string }>('/auth/password', { currentPassword, newPassword });
      setPasswordMessage(data.message);
      formElement.reset();
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Không thể đổi mật khẩu.'));
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">Đang tải hồ sơ...</div>;
  if (!profile) return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-red-600">{profileError || 'Không thể tải hồ sơ.'}</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Tài khoản</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Hồ sơ của tôi</h1>
        <p className="mt-2 text-sm text-slate-500">Cập nhật thông tin liên hệ và bảo mật tài khoản của bạn.</p>
      </div>

      <form onSubmit={saveProfile} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-4">
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt={`Ảnh đại diện của ${profile.fullName}`} className="h-20 w-20 rounded-full border border-slate-200 object-cover" />
            : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><UserRound className="h-8 w-8" /></span>}
          <div><h2 className="font-bold text-slate-900">Ảnh đại diện</h2><p className="mt-1 text-sm text-slate-500">Thêm đường dẫn ảnh để cập nhật avatar.</p></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Họ và tên
            <input name="fullName" required minLength={3} maxLength={255} defaultValue={profile.fullName} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-emerald-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Email
            <input value={profile.email} readOnly className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Số điện thoại
            <input name="phone" type="tel" maxLength={50} defaultValue={profile.phone ?? ''} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-emerald-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Địa chỉ
            <input name="address" maxLength={255} defaultValue={profile.address ?? ''} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-emerald-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2"><span className="inline-flex items-center gap-2"><Camera className="h-4 w-4" />Đường dẫn ảnh đại diện</span>
            <input name="avatarUrl" type="url" defaultValue={profile.avatarUrl ?? ''} placeholder="https://..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-emerald-500" />
          </label>
        </div>
        {(profileMessage || profileError) && <p role="status" className={`mt-4 text-sm ${profileError ? 'text-red-600' : 'text-emerald-700'}`}>{profileError || profileMessage}</p>}
        <button disabled={savingProfile} className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"><Save className="h-4 w-4" />{savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
      </form>

      <form onSubmit={changePassword} className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><LockKeyhole className="h-5 w-5 text-emerald-700" />Đổi mật khẩu</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">Mật khẩu hiện tại<input name="currentPassword" type="password" required minLength={6} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-emerald-500" /></label>
          <label className="text-sm font-semibold text-slate-700">Mật khẩu mới<input name="newPassword" type="password" required minLength={6} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-emerald-500" /></label>
          <label className="text-sm font-semibold text-slate-700">Xác nhận mật khẩu<input name="confirmPassword" type="password" required minLength={6} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-emerald-500" /></label>
        </div>
        {(passwordMessage || passwordError) && <p role="status" className={`mt-4 text-sm ${passwordError ? 'text-red-600' : 'text-emerald-700'}`}>{passwordError || passwordMessage}</p>}
        <button disabled={savingPassword} className="mt-6 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60">{savingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</button>
      </form>
    </div>
  );
}
