import { Prisma, PropertyType, type RoomType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireApprovedHost, requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const propertySchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  type: z.enum(['HOTEL', 'RESORT', 'VILLA', 'HOMESTAY', 'APARTMENT', 'MOTEL']),
  description: z.string().min(20),
  address: z.string().min(5),
  city: z.string().min(2),
  district: z.string().min(2),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  policies: z.array(z.string()).default([]),
  rooms: z.array(
    z.object({
      code: z.string().min(2),
      name: z.string().min(2),
      type: z.enum(['STANDARD', 'DELUXE', 'VIP', 'FAMILY']),
      description: z.string().min(10),
      basePrice: z.coerce.number().min(1000),
      maxGuests: z.coerce.number().min(1),
      availableRooms: z.coerce.number().min(1).default(1),
      images: z.array(z.string().url()).default([]),
      amenities: z.array(z.string()).default([]),
    }),
  ),
});

const propertyUpdateSchema = propertySchema.omit({ rooms: true });

router.get('/', async (req, res) => {
  const parsed = z.object({
    category: z.nativeEnum(PropertyType).optional(),
    type: z.nativeEnum(PropertyType).optional(),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid property category.' });
  const category = parsed.data.category ?? parsed.data.type;

  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE', ...(category ? { type: category } : {}) },
    include: {
      rooms: { where: { status: 'ACTIVE' } },
      host: {
        select: { id: true, fullName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(
    properties.map((property) => ({
      ...property,
      rooms: property.rooms.map((room) => ({ ...room, basePrice: Number(room.basePrice) })),
    })),
  );
});

router.get('/:id', async (req, res) => {
  const propertyId = String(req.params.id);
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      rooms: true,
      host: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!property) {
    return res.status(404).json({ message: 'Property not found.' });
  }

  if (property.status !== 'ACTIVE') {
    return res.status(404).json({ message: 'Property not found.' });
  }

  return res.json({
    ...property,
    rooms: property.rooms.filter((room) => room.status === 'ACTIVE').map((room) => ({ ...room, basePrice: Number(room.basePrice) })),
  });
});

router.post('/', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const parsed = propertySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid property payload.', issues: parsed.error.flatten() });
  }

  const { rooms, ...propertyData } = parsed.data;

  const property = await prisma.property.create({
    data: {
      ...propertyData,
      type: propertyData.type as PropertyType,
      hostId: req.user!.id,
      status: 'PENDING',
      rooms: {
        create: rooms.map((room) => ({
          code: room.code,
          name: room.name,
          type: room.type as RoomType,
          description: room.description,
          basePrice: room.basePrice,
          maxGuests: room.maxGuests,
          availableRooms: room.availableRooms,
          images: room.images,
          amenities: room.amenities,
          status: 'PENDING',
        })),
      },
    },
    include: {
      rooms: true,
      host: { select: { id: true, fullName: true, email: true } },
    },
  });

  return res.status(201).json({
    ...property,
    rooms: property.rooms.map((room) => ({ ...room, basePrice: Number(room.basePrice) })),
  });
});

router.patch('/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const propertyId = String(req.params.id);
  const property = await prisma.property.findUnique({ where: { id: propertyId } });

  if (!property) {
    return res.status(404).json({ message: 'Property not found.' });
  }

  if (property.hostId !== req.user!.id) {
    return res.status(403).json({ message: 'You can only manage your own properties.' });
  }

  const parsed = propertyUpdateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid property update payload.', issues: parsed.error.flatten() });
  }

  const updateData: any = {
    ...parsed.data,
    status: property.status === 'REJECTED' ? 'PENDING' : property.status,
  };

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: updateData,
    include: { rooms: true, host: { select: { id: true, fullName: true, email: true } } },
  });

  return res.json({
    ...updated,
    rooms: updated.rooms.map((room) => ({ ...room, basePrice: Number(room.basePrice) })),
  });
});

router.delete('/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const propertyId = String(req.params.id);
  const property = await prisma.property.findUnique({ where: { id: propertyId } });

  if (!property) {
    return res.status(404).json({ message: 'Property not found.' });
  }

  if (property.hostId !== req.user!.id) {
    return res.status(403).json({ message: 'You can only delete your own properties.' });
  }

  await prisma.property.delete({ where: { id: propertyId } });
  return res.json({ message: 'Property deleted successfully.' });
});

export default router;
