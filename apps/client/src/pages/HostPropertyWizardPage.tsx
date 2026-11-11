import { useEffect, useState, type ChangeEvent } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { uploadImages as uploadImageFiles } from '../lib/cloudinary';

type PropertyForm = {
  code: string;
  name: string;
  slug: string;
  type: string;
  description: string;
  address: string;
  detailAddress: string;
  city: string;
  district: string;
  ward: string;
  latitude: string;
  longitude: string;
  amenities: string[];
  images: string[];
  policies: string[];
};

type RoomForm = {
  code: string;
  name: string;
  type: string;
  description: string;
  basePrice: string;
  weekendPrice: string;
  holidayPrice: string;
  maxGuests: string;
  maxAdults: string;
  maxChildren: string;
  area: string;
  bedCount: string;
  bedType: string;
  availableRooms: string;
  images: string[];
  amenities: string[];
  status: string;
};

type SavedRoom = RoomForm & { id: string };
const emptyProperty: PropertyForm = {
  code: '', name: '', slug: '', type: 'HOTEL', description: '', address: '', detailAddress: '',
  city: '', district: '', ward: '', latitude: '', longitude: '', amenities: [], images: [], policies: ['', '', '', '', '', ''],
};
const emptyRoom: RoomForm = {
  code: '', name: '', type: 'STANDARD', description: '', basePrice: '500000', weekendPrice: '',
  holidayPrice: '', maxGuests: '2', maxAdults: '2', maxChildren: '0', area: '', bedCount: '1',
  bedType: '', availableRooms: '1', images: [], amenities: [], status: 'ACTIVE',
};
const steps = ['Cơ bản', 'Địa điểm', 'Hình ảnh', 'Tiện nghi', 'Chính sách', 'Loại phòng', 'Xem lại'];
const propertyTypes = [
  ['HOTEL', 'Khách sạn'], ['RESORT', 'Resort'], ['VILLA', 'Biệt thự'], ['HOMESTAY', 'Homestay'], ['APARTMENT', 'Căn hộ'], ['MOTEL', 'Nhà nghỉ'],
];
const roomTypes = [['STANDARD', 'Standard'], ['DELUXE', 'Deluxe'], ['VIP', 'VIP'], ['FAMILY', 'Family']];
const amenityOptions = ['Wi-Fi', 'Hồ bơi', 'Bãi đỗ xe', 'Nhà hàng', 'Điều hòa', 'Phòng gym', 'Spa', 'Lễ tân'];
const roomAmenityOptions = ['Wi-Fi', 'Điều hòa', 'TV', 'Minibar', 'Ban công', 'Bồn tắm', 'Máy sấy tóc', 'Bàn làm việc'];
const policyLabels = ['Giờ check-in', 'Giờ check-out', 'Chính sách hủy', 'Chính sách trẻ em', 'Chính sách vật nuôi', 'Nội quy'];

const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const textInput = 'w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

export function HostPropertyWizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<PropertyForm>(emptyProperty);
  const [rooms, setRooms] = useState<SavedRoom[]>([]);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoom);
  const [editingRoom, setEditingRoom] = useState('');
  const [roomImageUrl, setRoomImageUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [customAmenity, setCustomAmenity] = useState('');
  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState(id ?? '');
  const [propertyStatus, setPropertyStatus] = useState('DRAFT');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api.get(`/host/properties/${id}`).then(({ data }) => {
      if (!active) return;
      setPropertyId(data.id);
      setPropertyStatus(data.status);
      setRejectionReason(data.rejectionReason ?? '');
      setForm({
        code: data.code ?? '', name: data.name, slug: data.slug, type: data.type, description: data.description,
        address: data.address ?? '', detailAddress: data.detailAddress ?? '', city: data.city ?? '', district: data.district ?? '',
        ward: data.ward ?? '', latitude: data.latitude?.toString() ?? '', longitude: data.longitude?.toString() ?? '',
        amenities: data.amenities ?? [], images: data.images ?? [], policies: policyLabels.map((label, index) => {
          const policy = (data.policies ?? []).find((item: string) => item.startsWith(`${label}:`));
          return policy ? policy.slice(label.length + 1).trim() : data.policies?.[index] ?? '';
        }),
      });
      setRooms(data.rooms.map((room: any) => ({
        id: room.id, code: room.code, name: room.name, type: room.type, description: room.description,
        basePrice: String(room.basePrice), weekendPrice: room.weekendPrice == null ? '' : String(room.weekendPrice),
        holidayPrice: room.holidayPrice == null ? '' : String(room.holidayPrice), maxGuests: String(room.maxGuests),
        maxAdults: String(room.maxAdults), maxChildren: String(room.maxChildren), area: room.area == null ? '' : String(room.area),
        bedCount: String(room.bedCount), bedType: room.bedType ?? '', availableRooms: String(room.availableRooms),
        images: room.images, amenities: room.amenities, status: room.status,
      })));
    }).catch((err) => {
      if (active) setError(err?.response?.data?.message ?? 'Không thể tải cơ sở lưu trú.');
    });
    return () => { active = false; };
  }, [id]);

  const updateForm = <K extends keyof PropertyForm>(key: K, value: PropertyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateRoomForm = <K extends keyof RoomForm>(key: K, value: RoomForm[K]) => setRoomForm((current) => ({ ...current, [key]: value }));

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (!form.name.trim() || !form.code.trim() || form.description.trim().length < 20 || !form.address.trim() || !form.city.trim() || !form.district.trim()) {
        throw new Error('Để lưu bản nháp, hãy nhập tên, mã, mô tả (ít nhất 20 ký tự), địa chỉ, tỉnh/thành và quận/huyện.');
      }
      const payload = {
        ...form, slug: form.slug || slugify(form.name), latitude: form.latitude === '' ? undefined : Number(form.latitude),
        longitude: form.longitude === '' ? undefined : Number(form.longitude), detailAddress: form.detailAddress || null,
        ward: form.ward || null, policies: form.policies.map((value, index) => value.trim() ? `${policyLabels[index]}: ${value.trim()}` : '').filter(Boolean),
      };
      const response = propertyId
        ? await api.put(`/host/properties/${propertyId}`, payload)
        : await api.post('/host/properties', payload);
      setPropertyId(response.data.id);
      setPropertyStatus(response.data.status);
      if (response.data.status !== 'REJECTED') setRejectionReason('');
      if (!id) navigate(`/host/properties/${response.data.id}/edit`, { replace: true });
      setNotice('Bản nháp đã được lưu.');
      return response.data.id as string;
    } catch (err: any) {
      const message = err instanceof Error && !('response' in err) ? err.message : err?.response?.data?.message ?? 'Không thể lưu bản nháp.';
      setError(message);
      return '';
    } finally {
      setSaving(false);
    }
  };

  const validateStep = () => {
    if (step === 1 && (!form.name.trim() || form.code.trim().length < 2 || form.description.trim().length < 20)) {
      setError('Nhập tên, mã cơ sở và mô tả có ít nhất 20 ký tự.');
      return false;
    }
    if (step === 2 && (!form.address.trim() || !form.city.trim() || !form.district.trim())) {
      setError('Nhập địa chỉ, tỉnh/thành phố và quận/huyện.');
      return false;
    }
    setError('');
    return true;
  };

  const toggleAmenity = (value: string, room = false) => {
    if (room) updateRoomForm('amenities', roomForm.amenities.includes(value) ? roomForm.amenities.filter((item) => item !== value) : [...roomForm.amenities, value]);
    else updateForm('amenities', form.amenities.includes(value) ? form.amenities.filter((item) => item !== value) : [...form.amenities, value]);
  };

  const addImageUrl = () => {
    try {
      new URL(imageUrl);
      if (!/^https?:$/.test(new URL(imageUrl).protocol)) throw new Error();
      updateForm('images', form.images.includes(imageUrl) ? form.images : [...form.images, imageUrl]);
      setImageUrl('');
      setError('');
    } catch {
      setError('Vui lòng nhập URL ảnh bắt đầu bằng http:// hoặc https://.');
    }
  };

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setSaving(true);
    setError('');
    try {
      const urls = await uploadImageFiles(files);
      updateForm('images', [...form.images, ...urls].slice(0, 30));
    } catch (err) {
      setError(err instanceof Error ? `${err.message} Bạn vẫn có thể thêm ảnh bằng URL.` : 'Không thể tải ảnh lên.');
    } finally {
      setSaving(false);
    }
  };

  const setCover = (index: number) => updateForm('images', [form.images[index], ...form.images.filter((_, current) => current !== index)]);
  const moveImage = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= form.images.length) return;
    const images = [...form.images];
    [images[index], images[target]] = [images[target], images[index]];
    updateForm('images', images);
  };

  const editRoom = (room: SavedRoom) => {
    const { id: roomId, ...values } = room;
    setRoomForm(values);
    setEditingRoom(roomId);
  };

  const saveRoom = async () => {
    if (!propertyId) {
      setError('Hãy lưu thông tin cơ sở trước khi thêm loại phòng.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...roomForm,
        basePrice: Number(roomForm.basePrice),
        weekendPrice: roomForm.weekendPrice ? Number(roomForm.weekendPrice) : null,
        holidayPrice: roomForm.holidayPrice ? Number(roomForm.holidayPrice) : null,
        maxGuests: Number(roomForm.maxGuests), maxAdults: Number(roomForm.maxAdults), maxChildren: Number(roomForm.maxChildren),
        area: roomForm.area ? Number(roomForm.area) : null, bedCount: Number(roomForm.bedCount), availableRooms: Number(roomForm.availableRooms),
      };
      const response = editingRoom
        ? await api.put(`/host/room-types/${editingRoom}`, payload)
        : await api.post(`/host/properties/${propertyId}/room-types`, payload);
      const saved = { ...payload, ...response.data, id: response.data.id, basePrice: String(response.data.basePrice), weekendPrice: response.data.weekendPrice == null ? '' : String(response.data.weekendPrice), holidayPrice: response.data.holidayPrice == null ? '' : String(response.data.holidayPrice), maxGuests: String(response.data.maxGuests), maxAdults: String(response.data.maxAdults), maxChildren: String(response.data.maxChildren), area: response.data.area == null ? '' : String(response.data.area), bedCount: String(response.data.bedCount), availableRooms: String(response.data.availableRooms) } as SavedRoom;
      setRooms((current) => editingRoom ? current.map((room) => room.id === editingRoom ? saved : room) : [...current, saved]);
      setRoomForm(emptyRoom);
      setEditingRoom('');
      setNotice('Đã lưu loại phòng.');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể lưu loại phòng.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRoom = async (room: SavedRoom) => {
    if (!window.confirm(`Xóa loại phòng "${room.name}"?`)) return;
    try {
      await api.delete(`/host/room-types/${room.id}`);
      setRooms((current) => current.filter((item) => item.id !== room.id));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể xóa loại phòng.');
    }
  };

  const addRoomImage = () => {
    try {
      new URL(roomImageUrl);
      updateRoomForm('images', [...roomForm.images, roomImageUrl]);
      setRoomImageUrl('');
    } catch { setError('URL ảnh phòng chưa hợp lệ.'); }
  };

  const uploadRoomImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setSaving(true);
    setError('');
    try {
      const urls = await uploadImageFiles(files);
      updateRoomForm('images', [...roomForm.images, ...urls].slice(0, 30));
    } catch (err) {
      setError(err instanceof Error ? `${err.message} Bạn vẫn có thể thêm ảnh bằng URL.` : 'Không thể tải ảnh phòng lên.');
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    let savedId = propertyId;
    if (!savedId) savedId = await saveDraft();
    else if (await saveDraft() === '') return;
    if (!savedId) return;
    try {
      await api.post(`/host/properties/${savedId}/submit`);
      setPropertyStatus('PENDING_APPROVAL');
      setRejectionReason('');
      setNotice('Đã gửi cơ sở lưu trú để Admin kiểm duyệt.');
      navigate('/host/properties');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể gửi yêu cầu duyệt.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><Link to="/host/properties" className="text-sm font-semibold text-emerald-700">← Cơ sở lưu trú của tôi</Link><p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">WIZARD · {propertyStatus}</p><h1 className="mt-2 text-3xl font-black text-slate-950">{propertyId ? 'Cập nhật cơ sở lưu trú' : 'Thêm cơ sở lưu trú'}</h1></div>
        <button disabled={saving} onClick={() => void saveDraft()} className="rounded-full border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-800 disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu bản nháp'}</button>
      </header>
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>Bước {step} / {steps.length}</span><span>{steps[step - 1]}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(step / steps.length) * 100}%` }} /></div>
        <div className="mt-3 hidden grid-cols-7 gap-2 sm:grid">{steps.map((label, index) => <button key={label} onClick={() => { if (index + 1 <= step || validateStep()) setStep(index + 1); }} className={`truncate text-left text-xs ${step === index + 1 ? 'font-bold text-emerald-800' : 'text-slate-400'}`}>{index + 1}. {label}</button>)}</div>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <section className="min-h-[420px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        {rejectionReason && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Lý do Admin từ chối:</strong> {rejectionReason}. Chỉnh sửa thông tin rồi gửi lại để được kiểm duyệt.</p>}
        {step === 1 && <div className="space-y-5">
          <StepTitle title="Thông tin cơ bản" description="Thông tin nhận diện và giới thiệu cơ sở lưu trú." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên cơ sở lưu trú"><input className={textInput} value={form.name} onChange={(e) => { updateForm('name', e.target.value); if (!propertyId) updateForm('slug', slugify(e.target.value)); }} /></Field>
            <Field label="Mã cơ sở"><input className={textInput} value={form.code} onChange={(e) => updateForm('code', e.target.value.toUpperCase())} placeholder="VD: KS-ECHXANH" /></Field>
            <Field label="Loại hình"><select className={textInput} value={form.type} onChange={(e) => updateForm('type', e.target.value)}>{propertyTypes.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>
            <Field label="Slug"><input className={textInput} value={form.slug} onChange={(e) => updateForm('slug', slugify(e.target.value))} /></Field>
          </div>
          <Field label="Mô tả"><textarea className={`${textInput} min-h-32`} value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Mô tả không gian, dịch vụ và trải nghiệm…" /></Field>
        </div>}
        {step === 2 && <div className="space-y-5">
          <StepTitle title="Địa điểm" description="Địa chỉ giúp khách tìm và xác định vị trí của bạn." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Địa chỉ"><input className={textInput} value={form.address} onChange={(e) => updateForm('address', e.target.value)} /></Field>
            <Field label="Địa chỉ chi tiết"><input className={textInput} value={form.detailAddress} onChange={(e) => updateForm('detailAddress', e.target.value)} placeholder="Số nhà, tên đường…" /></Field>
            <Field label="Tỉnh / thành phố"><input className={textInput} value={form.city} onChange={(e) => updateForm('city', e.target.value)} /></Field>
            <Field label="Quận / huyện"><input className={textInput} value={form.district} onChange={(e) => updateForm('district', e.target.value)} /></Field>
            <Field label="Phường / xã"><input className={textInput} value={form.ward} onChange={(e) => updateForm('ward', e.target.value)} /></Field>
            <Field label="Vĩ độ (không bắt buộc)"><input type="number" step="any" className={textInput} value={form.latitude} onChange={(e) => updateForm('latitude', e.target.value)} /></Field>
            <Field label="Kinh độ (không bắt buộc)"><input type="number" step="any" className={textInput} value={form.longitude} onChange={(e) => updateForm('longitude', e.target.value)} /></Field>
          </div>
        </div>}
        {step === 3 && <div className="space-y-5">
          <StepTitle title="Hình ảnh" description="Ảnh đầu tiên là ảnh đại diện. Kéo thứ tự bằng cách chọn nút làm ảnh đại diện." />
          <div className="flex flex-wrap gap-3"><input className={`${textInput} min-w-0 flex-1`} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /><button onClick={addImageUrl} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Thêm URL</button><label className="cursor-pointer rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-800">Tải ảnh<input type="file" accept="image/*" multiple onChange={(e) => void uploadImages(e)} className="hidden" /></label></div>
          <p className="text-xs text-slate-500">Tải ảnh lên qua Cloudinary cần cấu hình VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET. Ảnh được lưu dưới dạng URL, không lưu binary trong cơ sở dữ liệu.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{form.images.map((image, index) => <div key={`${image}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200"><img src={image} alt={`Ảnh cơ sở ${index + 1}`} className="h-36 w-full object-cover" /><div className="flex flex-wrap items-center justify-between gap-2 p-2"><button onClick={() => setCover(index)} className={`text-xs font-semibold ${index === 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{index === 0 ? 'Ảnh đại diện' : 'Đặt làm đại diện'}</button><div className="flex gap-2"><button disabled={index === 0} onClick={() => moveImage(index, -1)} aria-label={`Chuyển ảnh ${index + 1} lên trước`} className="text-xs font-semibold text-slate-600 disabled:opacity-30">↑</button><button disabled={index === form.images.length - 1} onClick={() => moveImage(index, 1)} aria-label={`Chuyển ảnh ${index + 1} xuống sau`} className="text-xs font-semibold text-slate-600 disabled:opacity-30">↓</button><button onClick={() => updateForm('images', form.images.filter((_, current) => current !== index))} className="text-xs font-semibold text-red-600">Xóa</button></div></div></div>)}</div>
        </div>}
        {step === 4 && <div className="space-y-5"><StepTitle title="Tiện nghi cơ sở" description="Chọn tiện nghi có sẵn và bổ sung tiện nghi khác." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{amenityOptions.map((item) => <Check key={item} label={item} checked={form.amenities.includes(item)} onChange={() => toggleAmenity(item)} />)}</div><div className="flex gap-2"><input className={textInput} value={customAmenity} onChange={(e) => setCustomAmenity(e.target.value)} placeholder="Tiện nghi khác" /><button onClick={() => { const value = customAmenity.trim(); if (value) { toggleAmenity(value); setCustomAmenity(''); } }} className="rounded-xl border px-4 text-sm font-bold">Thêm</button></div><div className="flex flex-wrap gap-2">{form.amenities.filter((item) => !amenityOptions.includes(item)).map((item) => <button key={item} onClick={() => toggleAmenity(item)} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">{item} ×</button>)}</div></div>}
        {step === 5 && <div className="space-y-5"><StepTitle title="Chính sách" description="Cập nhật thông tin để khách nắm rõ trước khi đặt." />{policyLabels.map((label, index) => <Field key={label} label={label}><input className={textInput} value={form.policies[index] ?? ''} onChange={(e) => updateForm('policies', form.policies.map((value, current) => current === index ? e.target.value : value))} placeholder={index < 2 ? 'VD: 14:00' : 'Nhập chính sách…'} /></Field>)}</div>}
        {step === 6 && <div className="space-y-6">
          <StepTitle title="Thêm loại phòng" description="Một cơ sở có thể có nhiều loại phòng với giá và tồn kho riêng. Hãy lưu thông tin cơ sở trước khi thêm phòng." />
          {rooms.length > 0 && <div className="space-y-2">{rooms.map((room) => <div key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-semibold">{room.name} · {room.code}</p><p className="text-sm text-slate-500">{room.type} · {Number(room.basePrice).toLocaleString('vi-VN')} ₫/đêm · {room.availableRooms} phòng</p></div><div className="flex gap-2"><button onClick={() => editRoom(room)} className="text-sm font-semibold text-emerald-700">Sửa</button><button onClick={() => void deleteRoom(room)} className="text-sm font-semibold text-red-600">Xóa</button></div></div>)}</div>}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 sm:p-5">
            <h3 className="mb-4 font-bold text-slate-900">{editingRoom ? 'Chỉnh sửa loại phòng' : 'Loại phòng mới'}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Tên loại phòng"><input className={textInput} value={roomForm.name} onChange={(e) => updateRoomForm('name', e.target.value)} /></Field>
              <Field label="Mã loại phòng"><input className={textInput} value={roomForm.code} onChange={(e) => updateRoomForm('code', e.target.value.toUpperCase())} /></Field>
              <Field label="Phân loại"><select className={textInput} value={roomForm.type} onChange={(e) => updateRoomForm('type', e.target.value)}>{roomTypes.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>
              <Field label="Giá cơ bản / đêm"><input type="number" min="1000" className={textInput} value={roomForm.basePrice} onChange={(e) => updateRoomForm('basePrice', e.target.value)} /></Field>
              <Field label="Giá cuối tuần (tùy chọn)"><input type="number" min="1000" className={textInput} value={roomForm.weekendPrice} onChange={(e) => updateRoomForm('weekendPrice', e.target.value)} /></Field>
              <Field label="Giá ngày lễ (tùy chọn)"><input type="number" min="1000" className={textInput} value={roomForm.holidayPrice} onChange={(e) => updateRoomForm('holidayPrice', e.target.value)} /></Field>
              <Field label="Tổng số khách"><input type="number" min="1" className={textInput} value={roomForm.maxGuests} onChange={(e) => updateRoomForm('maxGuests', e.target.value)} /></Field>
              <Field label="Người lớn"><input type="number" min="1" className={textInput} value={roomForm.maxAdults} onChange={(e) => updateRoomForm('maxAdults', e.target.value)} /></Field>
              <Field label="Trẻ em"><input type="number" min="0" className={textInput} value={roomForm.maxChildren} onChange={(e) => updateRoomForm('maxChildren', e.target.value)} /></Field>
              <Field label="Diện tích (m²)"><input type="number" min="1" className={textInput} value={roomForm.area} onChange={(e) => updateRoomForm('area', e.target.value)} /></Field>
              <Field label="Số giường"><input type="number" min="1" className={textInput} value={roomForm.bedCount} onChange={(e) => updateRoomForm('bedCount', e.target.value)} /></Field>
              <Field label="Loại giường"><input className={textInput} value={roomForm.bedType} onChange={(e) => updateRoomForm('bedType', e.target.value)} placeholder="Giường đôi…" /></Field>
              <Field label="Số lượng phòng thực tế"><input type="number" min="0" className={textInput} value={roomForm.availableRooms} onChange={(e) => updateRoomForm('availableRooms', e.target.value)} /></Field>
              <Field label="Trạng thái"><select className={textInput} value={roomForm.status} onChange={(e) => updateRoomForm('status', e.target.value)}><option value="ACTIVE">Đang mở</option><option value="INACTIVE">Tạm đóng</option></select></Field>
            </div>
            <div className="mt-4"><Field label="Mô tả"><textarea className={`${textInput} min-h-24`} value={roomForm.description} onChange={(e) => updateRoomForm('description', e.target.value)} /></Field></div>
            <div className="mt-4"><p className={labelClass}>Tiện nghi phòng</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{roomAmenityOptions.map((item) => <Check key={item} label={item} checked={roomForm.amenities.includes(item)} onChange={() => toggleAmenity(item, true)} />)}</div></div>
            <div className="mt-4"><p className={labelClass}>Ảnh phòng</p><div className="flex flex-wrap gap-2"><input className={`${textInput} min-w-0 flex-1`} value={roomImageUrl} onChange={(e) => setRoomImageUrl(e.target.value)} placeholder="https://…" /><button onClick={addRoomImage} className="rounded-xl border px-4 text-sm font-bold">Thêm URL</button><label className="cursor-pointer rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-800">Tải ảnh<input type="file" accept="image/*" multiple onChange={(e) => void uploadRoomImages(e)} className="hidden" /></label></div><div className="mt-2 flex flex-wrap gap-2">{roomForm.images.map((image) => <button key={image} onClick={() => updateRoomForm('images', roomForm.images.filter((url) => url !== image))} className="max-w-48 truncate rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{image} ×</button>)}</div></div>
            <div className="mt-5 flex gap-2"><button disabled={saving} onClick={() => void saveRoom()} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Đang lưu…' : editingRoom ? 'Cập nhật loại phòng' : 'Thêm loại phòng'}</button>{editingRoom && <button onClick={() => { setEditingRoom(''); setRoomForm(emptyRoom); }} className="rounded-full border px-5 py-2.5 text-sm font-semibold">Hủy sửa</button>}</div>
          </div>
        </div>}
        {step === 7 && <div className="space-y-5">
          <StepTitle title="Xem lại và gửi duyệt" description="Kiểm tra nội dung trước khi chuyển cho Admin." />
          <div className="grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2"><Summary label="Cơ sở" value={`${form.name} (${form.code})`} /><Summary label="Loại hình" value={propertyTypes.find(([value]) => value === form.type)?.[1] ?? form.type} /><Summary label="Địa chỉ" value={[form.detailAddress, form.address, form.ward, form.district, form.city].filter(Boolean).join(', ')} /><Summary label="Hình ảnh / tiện nghi" value={`${form.images.length} ảnh · ${form.amenities.length} tiện nghi`} /><Summary label="Loại phòng" value={`${rooms.length} loại phòng · ${rooms.reduce((sum, room) => sum + Number(room.availableRooms), 0)} phòng thực tế`} /><Summary label="Chính sách" value={form.policies.filter(Boolean).length ? form.policies.filter(Boolean).join(' · ') : 'Chưa nhập'} /></div>
          {form.images[0] && <img src={form.images[0]} alt="Ảnh đại diện" className="h-56 w-full rounded-2xl object-cover" />}
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sau khi gửi, cơ sở sẽ hiển thị công khai khi Admin phê duyệt. Nếu bị từ chối, bạn có thể chỉnh sửa rồi gửi lại.</p>
        </div>}
      </section>
      <footer className="mt-5 flex justify-between gap-3"><button disabled={step === 1} onClick={() => { setStep((value) => value - 1); setError(''); }} className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-40">Quay lại</button><div className="flex gap-2">{step < steps.length ? <button onClick={() => { if (validateStep()) setStep((value) => Math.min(steps.length, value + 1)); }} className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-bold text-white">Tiếp tục</button> : <button disabled={saving || rooms.length === 0} onClick={() => void submitForReview()} className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">Gửi Admin duyệt</button>}</div></footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className={labelClass}>{label}</span>{children}</label>; }
function StepTitle({ title, description }: { title: string; description: string }) { return <div className="mb-5"><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) { return <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={onChange} className="accent-emerald-700" />{label}</label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value || '—'}</p></div>; }
