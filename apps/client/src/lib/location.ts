export type PropertyLocation = {
  id?: string;
  name: string;
  city: string | null;
  district: string;
  address: string;
  type: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function getCityName(city: unknown): string | null {
  return typeof city === 'string' && city.trim() ? city.trim() : null;
}

export function getCityLabel(city: unknown): string {
  return getCityName(city) ?? 'Chưa cập nhật địa điểm';
}

export function normalizePropertyLocation(value: unknown): PropertyLocation {
  const property = record(value);
  return {
    ...(typeof property?.id === 'string' ? { id: property.id } : {}),
    name: typeof property?.name === 'string' && property.name.trim() ? property.name : 'Chỗ nghỉ chưa cập nhật',
    city: getCityName(property?.city),
    district: typeof property?.district === 'string' ? property.district : '',
    address: typeof property?.address === 'string' ? property.address : '',
    type: typeof property?.type === 'string' ? property.type : '',
  };
}
