import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.js';

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
