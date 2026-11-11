import { z } from 'zod';

export interface AiEnvironment {
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  API_BASE_URL: string;
  AI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  CHAT_RATE_LIMITER: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
}

export type RoomCard = {
  id: string;
  name: string;
  type: string;
  basePrice: number;
  maxGuests: number;
  availableRooms: number;
  availabilityChecked?: boolean;
  averageNightlyPrice?: boolean;
  images: string[];
  amenities: string[];
  property: {
    id: string;
    name: string;
    city: string;
    district: string;
    address: string;
    type: string;
  };
};

const categorySchema = z.enum(['HOTEL', 'RESORT', 'VILLA', 'HOMESTAY', 'APARTMENT', 'MOTEL']);
const dateSchema = z.string().date();
const searchSchema = z.object({
  category: categorySchema.optional(),
  location: z.string().trim().max(100).optional(),
  minPrice: z.number().min(0).max(1000000000).optional(),
  maxPrice: z.number().min(0).max(1000000000).optional(),
  guests: z.number().int().min(1).max(50).optional(),
  checkIn: dateSchema.optional(),
  checkOut: dateSchema.optional(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
}).refine((value) => !value.checkIn || !value.checkOut || value.checkOut > value.checkIn, {
  message: 'Ngày trả phòng phải sau ngày nhận phòng.',
}).refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.maxPrice >= value.minPrice, {
  message: 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.',
});

const idSchema = z.object({ id: z.string().trim().min(1).max(100) });

export const tools = [
  {
    name: 'searchProperties',
    description: 'Tìm loại phòng đang được mở bán từ cơ sở lưu trú công khai thật. Dùng khi khách muốn tìm hoặc so sánh phòng.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['HOTEL', 'RESORT', 'VILLA', 'HOMESTAY', 'APARTMENT', 'MOTEL'] },
        location: { type: 'string', description: 'Tỉnh, thành phố, quận/huyện hoặc địa điểm khách muốn ở.' },
        minPrice: { type: 'number', description: 'Giá cơ bản tối thiểu mỗi đêm, VNĐ.' },
        maxPrice: { type: 'number', description: 'Giá cơ bản tối đa mỗi đêm, VNĐ.' },
        guests: { type: 'integer', description: 'Số khách cần phục vụ.' },
        checkIn: { type: 'string', description: 'Ngày nhận phòng dạng YYYY-MM-DD.' },
        checkOut: { type: 'string', description: 'Ngày trả phòng dạng YYYY-MM-DD.' },
        amenities: { type: 'array', items: { type: 'string' }, description: 'Các tiện nghi bắt buộc.' },
      },
    },
  },
  {
    name: 'getPropertyDetails',
    description: 'Lấy mô tả và thông tin có thật của một cơ sở lưu trú công khai.',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'ID cơ sở lưu trú.' } }, required: ['id'] },
  },
  {
    name: 'getRoomTypeDetails',
    description: 'Lấy thông tin có thật của một loại phòng công khai.',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'ID loại phòng.' } }, required: ['id'] },
  },
  {
    name: 'getBookingPolicy',
    description: 'Đọc chính sách được lưu tại cơ sở lưu trú. Cần ID cơ sở; không tự suy diễn chính sách.',
    parameters: { type: 'object', properties: { propertyId: { type: 'string', description: 'ID cơ sở lưu trú.' } }, required: ['propertyId'] },
  },
  {
    name: 'getMyBookings',
    description: 'Xem tóm tắt booking của chính người dùng đang đăng nhập. Không dùng để tra cứu người khác.',
    parameters: { type: 'object', properties: {} },
  },
];

type ToolCall = { name: string; arguments: unknown };

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function getToolCalls(result: unknown): ToolCall[] {
  if (typeof result !== 'object' || result === null || !('tool_calls' in result)) return [];
  const calls = (result as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.flatMap((call): ToolCall[] => {
    if (typeof call !== 'object' || call === null) return [];
    const item = call as { name?: unknown; arguments?: unknown; function?: { name?: unknown; arguments?: unknown } };
    const name = typeof item.name === 'string' ? item.name : item.function?.name;
    if (typeof name !== 'string') return [];
    return [{ name, arguments: parseToolArguments(item.arguments ?? item.function?.arguments) }];
  });
}

export function getModelText(result: unknown): string {
  if (typeof result !== 'object' || result === null || !('response' in result)) return '';
  const response = (result as { response?: unknown }).response;
  return typeof response === 'string' ? response.trim() : '';
}

function apiUrl(env: AiEnvironment, path: string, query?: URLSearchParams): string {
  const base = env.API_BASE_URL.trim().replace(/\/+$/, '');
  const url = new URL(`${base}${path}`);
  if (query) query.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

async function fetchApi(env: AiEnvironment, path: string, query?: URLSearchParams, authorization?: string): Promise<unknown> {
  const headers = new Headers({ Accept: 'application/json' });
  if (authorization) headers.set('Authorization', authorization);
  const response = await fetch(apiUrl(env, path, query), {
    headers,
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) {
    if (response.status === 401) return { error: 'Đăng nhập để xem đơn đặt phòng của bạn.' };
    if (response.status === 404) return { error: 'Không tìm thấy cơ sở lưu trú hoặc loại phòng công khai này.' };
    if (response.status >= 500) throw new Error('Dịch vụ dữ liệu hiện không khả dụng.');
    return { error: 'Không thể lấy dữ liệu phù hợp.' };
  }
  return response.json();
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeRoom(value: unknown): RoomCard | null {
  const room = record(value);
  const property = record(room.property);
  if (typeof room.id !== 'string' || typeof room.name !== 'string' || typeof property.id !== 'string') return null;
  const images = Array.isArray(room.images) ? room.images.filter((image): image is string => typeof image === 'string').slice(0, 3) : [];
  const amenities = Array.isArray(room.amenities) ? room.amenities.filter((amenity): amenity is string => typeof amenity === 'string').slice(0, 12) : [];
  return {
    id: room.id,
    name: room.name,
    type: typeof room.type === 'string' ? room.type : '',
    basePrice: Number(room.basePrice) || 0,
    maxGuests: Number(room.maxGuests) || 0,
    availableRooms: Number(room.availableRooms) || 0,
    images,
    amenities,
    property: {
      id: property.id,
      name: typeof property.name === 'string' ? property.name : '',
      city: typeof property.city === 'string' ? property.city : '',
      district: typeof property.district === 'string' ? property.district : '',
      address: typeof property.address === 'string' ? property.address : '',
      type: typeof property.type === 'string' ? property.type : '',
    },
  };
}

function safeProperty(value: unknown): Record<string, unknown> | { error: string } {
  const property = record(value);
  if (typeof property.id !== 'string') return { error: 'Không tìm thấy cơ sở lưu trú công khai này.' };
  return {
    id: property.id,
    name: property.name,
    type: property.type,
    description: property.description,
    address: property.address,
    city: property.city,
    district: property.district,
    images: Array.isArray(property.images) ? property.images.slice(0, 5) : [],
    amenities: Array.isArray(property.amenities) ? property.amenities : [],
    policies: Array.isArray(property.policies) ? property.policies : [],
    rooms: Array.isArray(property.rooms) ? property.rooms.map(safeRoom).filter(Boolean) : [],
  };
}

function safeRoomDetails(value: unknown): Record<string, unknown> | { error: string } {
  const room = record(value);
  const safe = safeRoom(room);
  if (!safe) return { error: 'Không tìm thấy loại phòng công khai này.' };
  return {
    ...safe,
    description: typeof room.description === 'string' ? room.description : '',
    maxAdults: Number(room.maxAdults) || 0,
    maxChildren: Number(room.maxChildren) || 0,
    area: typeof room.area === 'number' ? room.area : null,
    bedCount: Number(room.bedCount) || 0,
    bedType: typeof room.bedType === 'string' ? room.bedType : null,
    weekendPrice: typeof room.weekendPrice === 'number' ? room.weekendPrice : null,
    holidayPrice: typeof room.holidayPrice === 'number' ? room.holidayPrice : null,
  };
}

async function searchProperties(env: AiEnvironment, input: Record<string, unknown>): Promise<RoomCard[] | { error: string }> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { error: 'Tiêu chí tìm kiếm chưa hợp lệ.' };
  const criteria = parsed.data;
  const query = new URLSearchParams({ limit: '30' });
  if (criteria.location) query.set('q', criteria.location);
  if (criteria.category) query.set('category', criteria.category);
  const hasStayDates = Boolean(criteria.checkIn && criteria.checkOut);
  if (!hasStayDates && criteria.minPrice !== undefined) query.set('minPrice', String(criteria.minPrice));
  if (!hasStayDates && criteria.maxPrice !== undefined) query.set('maxPrice', String(criteria.maxPrice));
  if (criteria.guests !== undefined) query.set('maxGuests', String(criteria.guests));
  if (criteria.amenities?.length) query.set('amenities', criteria.amenities.join(','));
  const data = await fetchApi(env, '/rooms', query);
  if (!Array.isArray(data)) return { error: 'Không thể lấy danh sách phòng.' };
  const candidates = data.map(safeRoom).filter((room): room is RoomCard => room !== null).slice(0, 30);
  let matches = candidates;

  if (criteria.checkIn && criteria.checkOut && candidates.length) {
    matches = [];
    for (let offset = 0; offset < candidates.length && matches.length < 8; offset += 8) {
      const availability = await Promise.all(candidates.slice(offset, offset + 8).map(async (room) => {
        const params = new URLSearchParams({
          checkIn: criteria.checkIn!,
          checkOut: criteria.checkOut!,
          roomCount: '1',
        });
        try {
          const result = record(await fetchApi(env, `/bookings/availability/${encodeURIComponent(room.id)}`, params));
          if (result.available !== true) return null;
          const nightlyPrices = Array.isArray(result.nightlyPrices)
            ? result.nightlyPrices.map((item) => Number(record(item).price)).filter((price) => Number.isFinite(price) && price > 0)
            : [];
          if (!nightlyPrices.length) return null;
          if (criteria.maxPrice !== undefined && nightlyPrices.some((price) => price > criteria.maxPrice!)) return null;
          const averagePrice = nightlyPrices.reduce((sum, price) => sum + price, 0) / nightlyPrices.length;
          if (criteria.minPrice !== undefined && averagePrice < criteria.minPrice) return null;
          return {
            ...room,
            basePrice: Math.round(averagePrice),
            availableRooms: Number(result.availableRooms) || 0,
            averageNightlyPrice: true,
          };
        } catch {
          throw new Error('Không thể xác minh tình trạng phòng theo ngày đã chọn.');
        }
      }));
      for (const room of availability) {
        if (room) matches.push(room);
      }
    }
  }

  return matches.slice(0, 8).map((room) => ({
    ...room,
    availabilityChecked: Boolean(criteria.checkIn && criteria.checkOut),
  }));
}

export async function executeTool(
  env: AiEnvironment,
  call: ToolCall,
  authorization?: string,
): Promise<unknown> {
  const input = parseToolArguments(call.arguments);
  switch (call.name) {
    case 'searchProperties':
      return searchProperties(env, input);
    case 'getPropertyDetails': {
      const parsed = idSchema.safeParse(input);
      if (!parsed.success) return { error: 'ID cơ sở lưu trú chưa hợp lệ.' };
      return safeProperty(await fetchApi(env, `/properties/${encodeURIComponent(parsed.data.id)}`));
    }
    case 'getRoomTypeDetails': {
      const parsed = idSchema.safeParse(input);
      if (!parsed.success) return { error: 'ID loại phòng chưa hợp lệ.' };
      return safeRoomDetails(await fetchApi(env, `/rooms/${encodeURIComponent(parsed.data.id)}/details`));
    }
    case 'getBookingPolicy': {
      const parsed = z.object({ propertyId: z.string().trim().min(1).max(100) }).safeParse(input);
      if (!parsed.success) return { error: 'ID cơ sở lưu trú chưa hợp lệ.' };
      const property = safeProperty(await fetchApi(env, `/properties/${encodeURIComponent(parsed.data.propertyId)}`));
      if ('error' in property) return property;
      return { name: property.name, policies: property.policies };
    }
    case 'getMyBookings': {
      if (!authorization?.startsWith('Bearer ')) return { error: 'Bạn cần đăng nhập để xem đơn đặt phòng của mình.' };
      const data = await fetchApi(env, '/bookings/my', undefined, authorization);
      if (!Array.isArray(data)) return data;
      return data.slice(0, 10).map((value) => {
        const booking = record(value);
        const room = record(booking.room);
        const property = record(room.property);
        return {
          code: booking.code,
          status: booking.status,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          totalPrice: Number(booking.totalPrice) || 0,
          roomCount: Number(booking.roomCount) || 0,
          roomName: room.name,
          propertyName: property.name,
        };
      });
    }
    default:
      return { error: 'Công cụ không được hỗ trợ.' };
  }
}

export function isSearchRequest(message: string): boolean {
  return /(tìm|kiếm|có phòng|tư vấn|gợi ý|resort|khách sạn|homestay|biệt thự|căn hộ|nhà nghỉ|phòng nghỉ)/i.test(message);
}

export function parseSearchIntent(message: string): Record<string, unknown> {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');
  const category: Record<string, string> = {
    'khach san': 'HOTEL',
    'resort': 'RESORT',
    'biet thu': 'VILLA',
    'homestay': 'HOMESTAY',
    'can ho': 'APARTMENT',
    'nha nghi': 'MOTEL',
  };
  const categoryEntry = Object.entries(category).find(([phrase]) => normalized.includes(phrase));
  const priceMatch = normalized.match(/(?:duoi|toi da|ngan sach|budget)\s*([0-9][0-9.,]*)\s*(trieu|tr|m|nghin|ngan|k)?/);
  let maxPrice: number | undefined;
  if (priceMatch) {
    const amount = Number(priceMatch[1].replace(/[,.]/g, ''));
    const multiplier = ['trieu', 'tr', 'm'].includes(priceMatch[2] ?? '') ? 1000000 : ['nghin', 'ngan', 'k'].includes(priceMatch[2] ?? '') ? 1000 : 1;
    maxPrice = amount * multiplier;
  }
  const guestsMatch = normalized.match(/(\d{1,2})\s*(?:nguoi|khach)/);
  const knownLocations = ['ha noi', 'da nang', 'ho chi minh', 'tp hcm', 'sai gon', 'nha trang', 'da lat', 'phu quoc', 'hoi an', 'hai phong', 'can tho', 'vung tau'];
  const location = knownLocations.find((city) => normalized.includes(city));
  const dateMatches = [...message.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
  const amenities: Array<[string, string]> = [
    ['wi-fi', 'Wi-Fi'],
    ['wifi', 'Wi-Fi'],
    ['ho boi', 'Hồ bơi'],
    ['bai do xe', 'Bãi đỗ xe'],
    ['nha hang', 'Nhà hàng'],
    ['dieu hoa', 'Điều hòa'],
    ['phong gym', 'Phòng gym'],
    ['spa', 'Spa'],
  ];
  return {
    ...(categoryEntry ? { category: categoryEntry[1] } : {}),
    ...(location ? { location: location.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('vi')) } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    ...(guestsMatch ? { guests: Number(guestsMatch[1]) } : {}),
    ...(dateMatches.length >= 2 ? { checkIn: dateMatches[0], checkOut: dateMatches[1] } : {}),
    ...(amenities.filter(([phrase]) => normalized.includes(phrase)).length
      ? { amenities: [...new Set(amenities.filter(([phrase]) => normalized.includes(phrase)).map(([, amenity]) => amenity))] }
      : {}),
  };
}
