import { Router } from 'express';
import { PropertyType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const router = Router();

const roomsQuerySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  type: z.nativeEnum(PropertyType).optional(),
  category: z.nativeEnum(PropertyType).optional(),
  maxGuests: z.coerce.number().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  amenities: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'popular']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get('/', async (req, res) => {
  const parsed = roomsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid query parameters.' });
  }

  const { q, city, maxGuests, minPrice, maxPrice, sort, limit } = parsed.data;
  const type = parsed.data.category ?? parsed.data.type;
  const amenities = parsed.data.amenities?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];

  const rooms = await prisma.room.findMany({
    where: {
      status: 'ACTIVE',
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { property: { is: { name: { contains: q, mode: 'insensitive' } } } },
          { property: { is: { address: { contains: q, mode: 'insensitive' } } } },
          { property: { is: { city: { contains: q, mode: 'insensitive' } } } },
          { property: { is: { district: { contains: q, mode: 'insensitive' } } } },
        ],
      } : {}),
      ...(amenities.length > 0 ? { amenities: { hasEvery: amenities } } : {}),
      property: {
        is: {
          status: 'ACTIVE',
          ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
          ...(type ? { type } : {}),
        },
      },
      ...(maxGuests ? { maxGuests: { gte: maxGuests } } : {}),
      ...(minPrice || maxPrice ? {
        basePrice: {
          gte: minPrice ? minPrice : undefined,
          lte: maxPrice ? maxPrice : undefined,
        },
      } : {}),
    },
    include: {
      property: {
        include: {
          host: true,
        },
      },
    },
    orderBy: sort === 'price_asc' ? { basePrice: 'asc' } : sort === 'price_desc' ? { basePrice: 'desc' } : { createdAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  return res.json(rooms.map((room: any) => ({
    id: room.id,
    code: room.code,
    name: room.name,
    type: room.type,
    basePrice: Number(room.basePrice),
    maxGuests: room.maxGuests,
    images: room.images,
    amenities: room.amenities,
    availableRooms: room.availableRooms,
    property: {
      id: room.property.id,
      name: room.property.name,
      city: room.property.city,
      district: room.property.district,
      address: room.property.address,
      type: room.property.type,
    },
    host: {
      id: room.property.host.id,
      fullName: room.property.host.fullName,
    },
  })));
});

router.get('/:id/details', async (req, res) => {
  const room = await prisma.room.findFirst({
    where: {
      id: String(req.params.id),
      status: 'ACTIVE',
      property: { status: 'ACTIVE' },
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          type: true,
          city: true,
          district: true,
          address: true,
        },
      },
    },
  });

  if (!room) return res.status(404).json({ message: 'Room not found.' });
  return res.json({
    ...room,
    basePrice: Number(room.basePrice),
    weekendPrice: room.weekendPrice === null ? null : Number(room.weekendPrice),
    holidayPrice: room.holidayPrice === null ? null : Number(room.holidayPrice),
  });
});

router.get('/:id', async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: {
      property: {
        include: {
          host: true,
        },
      },
      bookings: true,
    },
  });

  if (!room) {
    return res.status(404).json({ message: 'Room not found.' });
  }
  if (room.status !== 'ACTIVE' || room.property.status !== 'ACTIVE') {
    return res.status(404).json({ message: 'Room not found.' });
  }

  return res.json({
    ...room,
    basePrice: Number(room.basePrice),
    property: {
      ...room.property,
      host: {
        id: room.property.host.id,
        fullName: room.property.host.fullName,
      },
    },
  });
});

export default router;
