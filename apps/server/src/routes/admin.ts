import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.js';
import { getPeakBookedRooms } from '../lib/bookingAvailability.js';
import { propertyInputSchema, roomInputSchema } from '../lib/hostSchemas.js';

const router = Router();

const hostStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

const propertyStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'APPROVED', 'PENDING', 'PENDING_APPROVAL', 'REJECTED', 'INACTIVE']),
  rejectionReason: z.string().trim().max(2000).optional(),
});

const bookingAdminSchema = z.object({
  status: z.literal('CANCELLED').optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'REFUNDED']).optional(),
}).refine((value) => value.status !== undefined || value.paymentStatus !== undefined);

router.get('/summary', requireAuth, requireRoles('ADMIN'), async (_req: AuthRequest, res) => {
  const totalUsers = await prisma.user.count();
  const totalBookings = await prisma.booking.count();
  const totalProperties = await prisma.property.count();
  const pendingApplications = await prisma.hostApplication.count({ where: { status: 'PENDING' } });
  const revenue = await prisma.booking.aggregate({
    where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'] } },
    _sum: { totalPrice: true },
  });

  return res.json({ totalUsers, totalBookings, totalProperties, pendingApplications, revenue: Number(revenue._sum.totalPrice ?? 0) });
});

router.get('/host-applications', requireAuth, requireRoles('ADMIN'), async (_req: AuthRequest, res) => {
  const applications = await prisma.hostApplication.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(applications);
});

router.patch('/host-applications/:id', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const parsed = hostStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid status payload.' });
  }

  const applicationId = String(req.params.id);
  const application = await prisma.hostApplication.findUnique({ where: { id: applicationId } });

  if (!application) {
    return res.status(404).json({ message: 'Application not found.' });
  }

  const updated = await prisma.hostApplication.update({
    where: { id: applicationId },
    data: {
      status: parsed.data.status,
      rejectionReason: parsed.data.rejectionReason,
    },
  });

  if (parsed.data.status === 'APPROVED') {
    await prisma.user.update({
      where: { id: application.userId },
      data: { role: 'HOST' },
    });
  } else {
    await prisma.user.update({
      where: { id: application.userId },
      data: { role: 'USER' },
    });
  }

  return res.json(updated);
});

router.get('/properties', requireAuth, requireRoles('ADMIN'), async (_req: AuthRequest, res) => {
  const properties = await prisma.property.findMany({
    include: { host: true, rooms: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(
    properties.map((property) => ({
      ...property,
      rooms: property.rooms.map((room) => ({ ...room, basePrice: Number(room.basePrice) })),
    })),
  );
});

router.post('/properties', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const parsed = propertyInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Thông tin cơ sở lưu trú chưa hợp lệ.', issues: parsed.error.flatten() });
  }
  try {
    const property = await prisma.property.create({
      data: { ...parsed.data, hostId: req.user!.id, status: 'ACTIVE', rejectionReason: null },
      include: { rooms: true },
    });
    return res.status(201).json(property);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Mã cơ sở hoặc đường dẫn đã được sử dụng.' });
    }
    throw error;
  }
});

router.put('/properties/:id', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const propertyId = String(req.params.id);
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return res.status(404).json({ message: 'Property not found.' });

  const parsed = propertyInputSchema.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return res.status(400).json({ message: 'Invalid property update payload.', issues: parsed.success ? undefined : parsed.error.flatten() });
  }
  try {
    return res.json(await prisma.property.update({ where: { id: propertyId }, data: parsed.data }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Mã cơ sở hoặc đường dẫn đã được sử dụng.' });
    }
    throw error;
  }
});

router.get('/properties/:id/rooms', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const propertyId = String(req.params.id);
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!property) return res.status(404).json({ message: 'Property not found.' });
  const rooms = await prisma.room.findMany({ where: { propertyId }, orderBy: { createdAt: 'asc' } });
  return res.json(rooms.map((room) => ({
    ...room,
    basePrice: Number(room.basePrice),
    weekendPrice: room.weekendPrice === null ? null : Number(room.weekendPrice),
    holidayPrice: room.holidayPrice === null ? null : Number(room.holidayPrice),
  })));
});

router.post('/properties/:id/rooms', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const propertyId = String(req.params.id);
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!property) return res.status(404).json({ message: 'Property not found.' });
  const parsed = roomInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Thông tin loại phòng chưa hợp lệ.', issues: parsed.error.flatten() });
  }
  try {
    const room = await prisma.room.create({
      data: {
        ...parsed.data,
        status: 'ACTIVE',
        basePrice: new Prisma.Decimal(parsed.data.basePrice),
        weekendPrice: parsed.data.weekendPrice == null ? null : new Prisma.Decimal(parsed.data.weekendPrice),
        holidayPrice: parsed.data.holidayPrice == null ? null : new Prisma.Decimal(parsed.data.holidayPrice),
        propertyId,
      },
    });
    return res.status(201).json({
      ...room,
      basePrice: Number(room.basePrice),
      weekendPrice: room.weekendPrice === null ? null : Number(room.weekendPrice),
      holidayPrice: room.holidayPrice === null ? null : Number(room.holidayPrice),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Mã loại phòng đã được sử dụng.' });
    }
    throw error;
  }
});

router.patch('/rooms/:id', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const roomId = String(req.params.id);
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return res.status(404).json({ message: 'Room not found.' });
  const parsed = roomInputSchema.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return res.status(400).json({ message: 'Invalid room update payload.', issues: parsed.success ? undefined : parsed.error.flatten() });
  }
  if (parsed.data.availableRooms !== undefined && parsed.data.availableRooms < room.availableRooms) {
    const bookings = await prisma.booking.findMany({
      where: { roomId: room.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkOut: { gt: new Date() } },
      select: { checkIn: true, checkOut: true, roomCount: true },
    });
    if (getPeakBookedRooms(bookings) > parsed.data.availableRooms) {
      return res.status(409).json({ message: 'Không thể giảm số phòng thấp hơn số phòng đã được đặt.' });
    }
  }
  const data = {
    ...parsed.data,
    ...(parsed.data.basePrice === undefined ? {} : { basePrice: new Prisma.Decimal(parsed.data.basePrice) }),
    ...(parsed.data.weekendPrice === undefined ? {} : { weekendPrice: parsed.data.weekendPrice === null ? null : new Prisma.Decimal(parsed.data.weekendPrice) }),
    ...(parsed.data.holidayPrice === undefined ? {} : { holidayPrice: parsed.data.holidayPrice === null ? null : new Prisma.Decimal(parsed.data.holidayPrice) }),
  };
  try {
    const updated = await prisma.room.update({ where: { id: roomId }, data });
    return res.json({
      ...updated,
      basePrice: Number(updated.basePrice),
      weekendPrice: updated.weekendPrice === null ? null : Number(updated.weekendPrice),
      holidayPrice: updated.holidayPrice === null ? null : Number(updated.holidayPrice),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Mã loại phòng đã được sử dụng.' });
    }
    throw error;
  }
});

router.delete('/rooms/:id', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const room = await prisma.room.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
  if (!room) return res.status(404).json({ message: 'Room not found.' });
  const updated = await prisma.room.update({ where: { id: room.id }, data: { status: 'INACTIVE' } });
  return res.json({ ...updated, basePrice: Number(updated.basePrice) });
});

router.patch('/properties/:id', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const parsed = propertyStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid property status payload.' });
  }

  const propertyId = String(req.params.id);
  const property = await prisma.property.findUnique({ where: { id: propertyId } });

  if (!property) {
    return res.status(404).json({ message: 'Property not found.' });
  }

  const status = parsed.data.status === 'APPROVED' ? 'ACTIVE'
    : parsed.data.status === 'PENDING' ? 'PENDING_APPROVAL'
      : parsed.data.status;
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.property.update({
      where: { id: propertyId },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? parsed.data.rejectionReason ?? 'Cơ sở lưu trú chưa đáp ứng yêu cầu kiểm duyệt.' : null,
      },
    });
    if (status === 'ACTIVE') {
      await tx.room.updateMany({ where: { propertyId, status: 'PENDING' }, data: { status: 'ACTIVE' } });
    }
    await tx.notification.create({
      data: {
        userId: property.hostId,
        title: status === 'ACTIVE' ? 'Cơ sở lưu trú đã được duyệt' : status === 'REJECTED' ? 'Cơ sở lưu trú chưa được duyệt' : 'Trạng thái cơ sở lưu trú đã cập nhật',
        message: status === 'REJECTED'
          ? `${property.name}: ${parsed.data.rejectionReason ?? 'Cơ sở lưu trú chưa đáp ứng yêu cầu kiểm duyệt.'}`
          : `${property.name}: ${status === 'ACTIVE' ? 'cơ sở đã hiển thị công khai.' : `trạng thái hiện tại là ${status}.`}`,
      },
    });
    return result;
  });

  return res.json(updated);
});

router.get('/bookings', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const parsed = z.object({
    status: z.enum(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'COMPLETED']).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    hostId: z.string().optional(),
    userId: z.string().optional(),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid booking filters.' });
  const { status, from, to, hostId, userId } = parsed.data;
  if (from && to && from > to) return res.status(400).json({ message: 'The date range is invalid.' });

  const bookings = await prisma.booking.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(hostId ? { room: { property: { hostId } } } : {}),
      ...(from || to ? {
        checkIn: { ...(to ? { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000) } : {}) },
        checkOut: { ...(from ? { gt: new Date(`${from}T00:00:00.000Z`) } : {}) },
      } : {}),
    },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      room: {
        include: {
          property: { include: { host: { select: { id: true, fullName: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return res.json(
    bookings.map((booking) => ({
      ...booking,
      totalPrice: Number(booking.totalPrice),
      serviceFee: Number(booking.serviceFee),
      room: {
        ...booking.room,
        basePrice: Number(booking.room.basePrice),
      },
    })),
  );
});

router.patch('/bookings/:id', requireAuth, requireRoles('ADMIN'), async (req: AuthRequest, res) => {
  const parsed = bookingAdminSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid booking status payload.' });
  }

  const bookingId = String(req.params.id);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found.' });
  }
  if (parsed.data.status === 'CANCELLED' && booking.status !== 'CONFIRMED') {
    return res.status(409).json({ message: 'Only confirmed bookings that have not checked in can be cancelled.' });
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.paymentStatus ? { paymentStatus: parsed.data.paymentStatus } : {}),
      ...(parsed.data.status === 'CANCELLED' && booking.paymentStatus === 'PAID' ? { paymentStatus: 'REFUNDED' } : {}),
    },
  });

  return res.json(updated);
});

export default router;
