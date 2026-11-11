import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getPeakBookedRooms } from '../lib/bookingAvailability.js';
import { requireApprovedHost, requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const bookingSchema = z.object({
  roomId: z.string().min(1),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  guestCount: z.coerce.number().min(1),
  roomCount: z.coerce.number().min(1).max(10),
});

const nightsBetween = (start: Date, end: Date) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const activeBookingStatuses = ['CONFIRMED', 'CHECKED_IN'] as const;

router.get('/availability/:roomId', async (req, res) => {
  const parsed = z.object({
    checkIn: z.string().date(),
    checkOut: z.string().date(),
    roomCount: z.coerce.number().int().min(1).max(10).default(1),
  }).safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid availability query.' });
  }

  const room = await prisma.room.findUnique({
    where: { id: String(req.params.roomId) },
    select: { id: true, availableRooms: true, status: true, basePrice: true, weekendPrice: true, property: { select: { status: true } } },
  });
  if (!room || room.status !== 'ACTIVE' || room.property.status !== 'ACTIVE') {
    return res.status(404).json({ message: 'Selected room is not available.' });
  }

  const checkIn = new Date(`${parsed.data.checkIn}T00:00:00.000Z`);
  const checkOut = new Date(`${parsed.data.checkOut}T00:00:00.000Z`);
  if (checkOut <= checkIn || checkIn < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')) {
    return res.status(400).json({ message: 'Check-in and check-out dates are invalid.' });
  }

  const conflicts = await prisma.booking.findMany({
    where: {
      roomId: room.id,
      status: { in: [...activeBookingStatuses] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { checkIn: true, checkOut: true, roomCount: true },
  });
  const [blockedDates, dayPrices] = await Promise.all([
    prisma.roomAvailability.findMany({
      where: { roomId: room.id, date: { gte: checkIn, lt: checkOut }, status: { in: ['CLOSED', 'MAINTENANCE'] } },
      select: { date: true },
    }),
    prisma.roomPrice.findMany({ where: { roomId: room.id, date: { gte: checkIn, lt: checkOut } } }),
  ]);
  const blocked = new Set(blockedDates.map((item) => item.date.toISOString().slice(0, 10)));
  const prices = new Map(dayPrices.map((item) => [item.date.toISOString().slice(0, 10), Number(item.price)]));
  const nightlyPrices = [];
  let availableRooms = room.availableRooms;
  for (let cursor = checkIn.getTime(); cursor < checkOut.getTime(); cursor += 86400000) {
    const date = new Date(cursor);
    const dateKey = date.toISOString().slice(0, 10);
    const dayEnd = new Date(cursor + 86400000);
    const bookedRooms = conflicts
      .filter((booking) => booking.checkIn < dayEnd && booking.checkOut > date)
      .reduce((sum, booking) => sum + booking.roomCount, 0);
    availableRooms = Math.min(availableRooms, Math.max(0, room.availableRooms - bookedRooms));
    const weekendPrice = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? room.weekendPrice : null;
    nightlyPrices.push({ date: dateKey, price: prices.get(dateKey) ?? Number(weekendPrice ?? room.basePrice) });
  }
  return res.json({
    available: availableRooms >= parsed.data.roomCount && blocked.size === 0,
    availableRooms: blocked.size ? 0 : availableRooms,
    blockedDates: [...blocked],
    nightlyPrices,
  });
});

router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user!.id },
    include: { room: { include: { property: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(
    bookings.map((booking: any) => ({
      ...booking,
      room: {
        ...booking.room,
        basePrice: Number(booking.room.basePrice),
      },
      totalPrice: Number(booking.totalPrice),
      serviceFee: Number(booking.serviceFee),
    })),
  );
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = bookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid booking payload.', issues: parsed.error.flatten() });
  }

  const { roomId, checkIn, checkOut, guestCount, roomCount } = parsed.data;
  const checkInDate = new Date(`${checkIn}T00:00:00.000Z`);
  const checkOutDate = new Date(`${checkOut}T00:00:00.000Z`);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  if (checkOutDate <= checkInDate || checkInDate < today) {
    return res.status(400).json({ message: 'Check-in and check-out dates are invalid.' });
  }

  if (nightsBetween(checkInDate, checkOutDate) > 90) {
    return res.status(400).json({ message: 'Bookings may not exceed 90 nights.' });
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId }, include: { property: true } });
      if (!room || room.status !== 'ACTIVE' || room.property.status !== 'ACTIVE') {
        throw new Error('ROOM_UNAVAILABLE');
      }
      if (guestCount > room.maxGuests * roomCount) {
        throw new Error('GUEST_CAPACITY_EXCEEDED');
      }

      const overlapping = await tx.booking.findMany({
        where: {
          roomId,
          status: { in: [...activeBookingStatuses] },
          checkIn: { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
        select: { checkIn: true, checkOut: true, roomCount: true },
      });
      if (getPeakBookedRooms(overlapping) + roomCount > room.availableRooms) {
        throw new Error('ROOMS_SOLD_OUT');
      }

      const [blockedDates, dayPrices] = await Promise.all([
        tx.roomAvailability.findMany({
          where: { roomId, date: { gte: checkInDate, lt: checkOutDate }, status: { in: ['CLOSED', 'MAINTENANCE'] } },
          select: { date: true },
        }),
        tx.roomPrice.findMany({ where: { roomId, date: { gte: checkInDate, lt: checkOutDate } } }),
      ]);
      if (blockedDates.length) throw new Error('DATES_CLOSED');
      const priceByDate = new Map(dayPrices.map((item) => [item.date.toISOString().slice(0, 10), item.price]));
      const serviceFee = new Prisma.Decimal(0);
      let totalPrice = new Prisma.Decimal(0);
      for (let cursor = checkInDate.getTime(); cursor < checkOutDate.getTime(); cursor += 86400000) {
        const date = new Date(cursor);
        const dateKey = date.toISOString().slice(0, 10);
        const price = priceByDate.get(dateKey)
          ?? (date.getUTCDay() === 0 || date.getUTCDay() === 6 ? room.weekendPrice : null)
          ?? room.basePrice;
        totalPrice = totalPrice.add(price);
      }
      totalPrice = totalPrice.mul(roomCount).add(serviceFee);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: req.user!.id },
        select: { fullName: true },
      });
      const created = await tx.booking.create({
        data: {
          code: `BK-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
          userId: req.user!.id,
          roomId,
          roomCount,
          guestCount,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          serviceFee,
          totalPrice,
          status: 'CONFIRMED',
          paymentStatus: 'PENDING',
          roomSnapshot: JSON.stringify({ name: room.name, type: room.type, basePrice: room.basePrice.toString() }),
          propertySnapshot: JSON.stringify({ name: room.property.name, city: room.property.city }),
          hostSnapshot: JSON.stringify({ hostName: room.property.hostId }),
        },
      });

      await tx.notification.create({
        data: {
          userId: room.property.hostId,
          title: 'Đơn đặt phòng mới',
          message: `${user.fullName} đã đặt ${roomCount} phòng ${room.name} tại ${room.property.name} (${checkIn} - ${checkOut}).`,
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.status(201).json({
      ...booking,
      totalPrice: Number(booking.totalPrice),
      serviceFee: Number(booking.serviceFee),
    });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === 'ROOMS_SOLD_OUT' ? 409
        : error.message === 'DATES_CLOSED' ? 409
        : error.message === 'GUEST_CAPACITY_EXCEEDED' ? 400
          : error.message === 'ROOM_UNAVAILABLE' ? 404 : undefined;
      if (status) return res.status(status).json({ message: error.message === 'ROOMS_SOLD_OUT' ? 'Not enough rooms are available for the selected dates.' : error.message === 'DATES_CLOSED' ? 'Selected room is closed or under maintenance for some selected dates.' : error.message === 'GUEST_CAPACITY_EXCEEDED' ? 'Guest count exceeds the selected room capacity.' : 'Selected room is not available.' });
      if ('code' in error && error.code === 'P2034') {
        return res.status(409).json({ message: 'Availability changed while booking. Please check again and retry.' });
      }
    }
    throw error;
  }
});

router.patch('/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  const bookingId = String(req.params.id);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found.' });
  }

  if (booking.userId !== req.user!.id) {
    return res.status(403).json({ message: 'You can only cancel your own booking.' });
  }

  if (!['CONFIRMED'].includes(booking.status)) {
    return res.status(409).json({ message: 'Only confirmed bookings can be cancelled.' });
  }
  const cancellationDeadline = new Date(booking.checkIn.getTime() - 48 * 60 * 60 * 1000);
  if (new Date() > cancellationDeadline) {
    return res.status(400).json({ message: 'Free cancellation is only available at least 48 hours before check-in.' });
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      ...(booking.paymentStatus === 'PAID' ? { paymentStatus: 'REFUNDED' } : {}),
    },
  });

  return res.json(updated);
});

export default router;
