import {
  BedDouble,
  Building,
  Building2,
  House,
  LayoutGrid,
  Store,
  Waves,
  type LucideIcon,
} from 'lucide-react';

export const propertyTypeLabels: Record<string, string> = {
  HOTEL: 'Khách sạn',
  RESORT: 'Resort',
  VILLA: 'Biệt thự',
  HOMESTAY: 'Homestay',
  APARTMENT: 'Căn hộ',
  MOTEL: 'Nhà nghỉ',
};

export const propertyCategories: Array<{ label: string; value: string; icon: LucideIcon }> = [
  { label: 'Tất cả', value: '', icon: LayoutGrid },
  { label: propertyTypeLabels.HOTEL, value: 'HOTEL', icon: Building2 },
  { label: propertyTypeLabels.RESORT, value: 'RESORT', icon: Waves },
  { label: propertyTypeLabels.VILLA, value: 'VILLA', icon: House },
  { label: propertyTypeLabels.HOMESTAY, value: 'HOMESTAY', icon: BedDouble },
  { label: propertyTypeLabels.APARTMENT, value: 'APARTMENT', icon: Building },
  { label: propertyTypeLabels.MOTEL, value: 'MOTEL', icon: Store },
];
