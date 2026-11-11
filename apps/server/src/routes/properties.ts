import { Prisma, PropertyType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { propertyInputSchema, roomInputSchema } from '../lib/hostSchemas.js';
import { requireApprovedHost, requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const propertySchema = propertyInputSchema.extend({ rooms: z.array(roomInputSchema) });

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
      hostId: req.user!.id,
      status: 'ACTIVE',
      rooms: {
        create: rooms.map((room) => ({
          code: room.code,
          name: room.name,
          type: room.type,
          description: room.description,
          basePrice: new Prisma.Decimal(room.basePrice),
          weekendPrice: room.weekendPrice == null ? null : new Prisma.Decimal(room.weekendPrice),
          holidayPrice: room.holidayPrice == null ? null : new Prisma.Decimal(room.holidayPrice),
          maxGuests: room.maxGuests,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
          area: room.area,
          bedCount: room.bedCount,
          bedType: room.bedType,
          availableRooms: room.availableRooms,
          images: room.images,
          amenities: room.amenities,
          status: 'ACTIVE' as const,
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
    status: property.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    rejectionReason: null,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.property.update({
      where: { id: propertyId },
      data: updateData,
      include: { rooms: true, host: { select: { id: true, fullName: true, email: true } } },
    });
    if (updateData.status === 'ACTIVE') {
      await tx.room.updateMany({ where: { propertyId, status: 'PENDING' }, data: { status: 'ACTIVE' } });
    }
    return result;
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

  const updated = await prisma.property.update({ where: { id: propertyId }, data: { status: 'INACTIVE' } });
  return res.json(updated);
});

export default router;
