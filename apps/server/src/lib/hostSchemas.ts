import { PropertyType, RoomType } from '@prisma/client';
import { z } from 'zod';

const imageList = z.array(z.string().url().max(2048)).max(30).default([]);

export const propertyInputSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(3).max(255),
  slug: z.string().trim().min(3).max(255),
  type: z.nativeEnum(PropertyType),
  description: z.string().trim().min(20),
  address: z.string().trim().min(5).max(255),
  detailAddress: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().min(2).max(120),
  district: z.string().trim().min(2).max(120),
  ward: z.string().trim().max(120).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  amenities: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  images: imageList,
  policies: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
});

export const roomInputSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(255),
  type: z.nativeEnum(RoomType),
  description: z.string().trim().min(10),
  basePrice: z.coerce.number().min(1000).max(1000000000),
  weekendPrice: z.coerce.number().min(1000).max(1000000000).optional().nullable(),
  holidayPrice: z.coerce.number().min(1000).max(1000000000).optional().nullable(),
  maxGuests: z.coerce.number().int().min(1).max(50),
  maxAdults: z.coerce.number().int().min(1).max(50).default(2),
  maxChildren: z.coerce.number().int().min(0).max(50).default(0),
  area: z.coerce.number().min(1).max(10000).optional().nullable(),
  bedCount: z.coerce.number().int().min(1).max(50).default(1),
  bedType: z.string().trim().max(80).optional().nullable(),
  availableRooms: z.coerce.number().int().min(0).max(500).default(1),
  images: imageList,
  amenities: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
