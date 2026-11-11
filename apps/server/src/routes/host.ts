import { Router } from 'express';
import { Prisma, PropertyType, RoomType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getPeakBookedRooms } from '../lib/bookingAvailability.js';
import { requireApprovedHost, requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const imageList = z.array(z.string().url().max(2048)).max(30).default([]);
const propertyInputSchema = z.object({
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

const roomInputSchema = z.object({
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

const dateOnly = z.string().date();
const calendarRangeSchema = z.object({ from: dateOnly, to: dateOnly }).refine((value) => {
  const from = new Date(`${value.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${value.to}T00:00:00.000Z`).getTime();
  return to >= from && to - from <= 366 * 86400000;
}, { message: 'Date range must be between 1 and 367 days.' });

const ownedProperty = (propertyId: string, hostId: string) => prisma.property.findFirst({
  where: { id: propertyId, hostId },
});

const ownedRoom = (roomId: string, hostId: string) => prisma.room.findFirst({
  where: { id: roomId, property: { hostId } },
});

const hostApplicationSchema = z.object({
  fullName: z.string().min(3),
  phone: z.string().optional(),
  address: z.string().optional(),
  cccd: z.string().optional(),
  bio: z.string().optional(),
  contactInfo: z.string().optional(),
  reason: z.string().optional(),
});

router.post('/application', requireAuth, async (req: AuthRequest, res) => {
  const parsed = hostApplicationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid host application payload.', issues: parsed.error.flatten() });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { hostApplication: true },
  });

  if (!currentUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (currentUser.role === 'HOST') {
    return res.status(409).json({ message: 'This account already has host access.' });
  }

  const existing = await prisma.hostApplication.findUnique({ where: { userId: req.user!.id } });
  if (existing?.status === 'PENDING' || existing?.status === 'APPROVED') {
    return res.status(409).json({ message: 'A host application already exists for this user.' });
  }

  const applicationData = {
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    address: parsed.data.address,
    cccd: parsed.data.cccd,
    bio: parsed.data.bio,
    contactInfo: parsed.data.contactInfo,
    reason: parsed.data.reason,
    status: 'PENDING' as const,
    rejectionReason: null,
  };
  const application = existing
    ? await prisma.hostApplication.update({ where: { userId: req.user!.id }, data: applicationData })
    : await prisma.hostApplication.create({ data: { userId: req.user!.id, ...applicationData } });

  return res.status(201).json(application);
});

router.get('/application-status', requireAuth, async (req: AuthRequest, res) => {
  const application = await prisma.hostApplication.findUnique({
    where: { userId: req.user!.id },
  });

  return res.json({ application });
});

router.get('/dashboard', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const rooms = await prisma.room.count({ where: { property: { hostId: req.user!.id } } });
  const properties = await prisma.property.count({ where: { hostId: req.user!.id } });
  const inventory = await prisma.room.aggregate({ where: { property: { hostId: req.user!.id } }, _sum: { availableRooms: true } });
  const bookings = await prisma.booking.count({ where: { room: { property: { hostId: req.user!.id } } } });
  const confirmed = await prisma.booking.count({
    where: { room: { property: { hostId: req.user!.id } }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
  });
  const pending = await prisma.booking.count({
    where: {
      room: { property: { hostId: req.user!.id } },
      paymentStatus: 'PENDING',
      status: { not: 'CANCELLED' },
    },
  });

  const revenueRows = await prisma.booking.groupBy({
    by: ['status'],
    where: {
      room: { property: { hostId: req.user!.id } },
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'] },
    },
    _sum: { totalPrice: true },
  });

  return res.json({
    properties,
    rooms,
    physicalRooms: inventory._sum.availableRooms ?? 0,
    bookings,
    confirmed,
    pending,
    revenue: revenueRows.reduce((sum: number, item: any) => sum + Number(item._sum.totalPrice ?? 0), 0),
  });
});

router.get('/properties', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const properties = await prisma.property.findMany({
    where: { hostId: req.user!.id },
    include: { rooms: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(
    properties.map((property) => ({
      ...property,
      rooms: property.rooms.map((room) => ({ ...room, basePrice: Number(room.basePrice) })),
    })),
  );
});

router.post('/properties', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const parsed = propertyInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Thông tin cơ sở lưu trú chưa hợp lệ.', issues: parsed.error.flatten() });
    try {
      const property = await prisma.property.create({
        data: { ...parsed.data, hostId: req.user!.id, status: 'DRAFT' },
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

  router.get('/properties/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await prisma.property.findFirst({
      where: { id: String(req.params.id), hostId: req.user!.id },
      include: { rooms: { orderBy: { createdAt: 'asc' } } },
    });
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    return res.json({
      ...property,
      rooms: property.rooms.map((room) => ({
        ...room,
        basePrice: Number(room.basePrice),
        weekendPrice: room.weekendPrice === null ? null : Number(room.weekendPrice),
        holidayPrice: room.holidayPrice === null ? null : Number(room.holidayPrice),
      })),
    });
  });

  router.put('/properties/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await ownedProperty(String(req.params.id), req.user!.id);
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    const parsed = propertyInputSchema.partial().safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
      return res.status(400).json({ message: 'Thông tin cập nhật chưa hợp lệ.', issues: parsed.success ? undefined : parsed.error.flatten() });
    }
    try {
      const updated = await prisma.property.update({
        where: { id: property.id },
        data: {
          ...parsed.data,
          ...(property.status === 'ACTIVE' ? { status: 'PENDING_APPROVAL', rejectionReason: null } : {}),
        },
      });
      return res.json(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ message: 'Mã cơ sở hoặc đường dẫn đã được sử dụng.' });
      }
      throw error;
    }
  });

  router.delete('/properties/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await ownedProperty(String(req.params.id), req.user!.id);
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    const updated = await prisma.property.update({ where: { id: property.id }, data: { status: 'INACTIVE' } });
    return res.json(updated);
  });

  router.post('/properties/:id/submit', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await prisma.property.findFirst({
      where: { id: String(req.params.id), hostId: req.user!.id },
      include: { rooms: { select: { id: true } } },
    });
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    if (!property.rooms.length) return res.status(409).json({ message: 'Hãy thêm ít nhất một loại phòng trước khi gửi duyệt.' });
    if (property.status === 'ACTIVE') return res.status(409).json({ message: 'Cơ sở lưu trú này đã được duyệt.' });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.property.update({
        where: { id: property.id },
        data: { status: 'PENDING_APPROVAL', rejectionReason: null },
      });
      const admins = await tx.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map(({ id }) => ({
            userId: id,
            title: 'Cơ sở lưu trú chờ duyệt',
            message: `${property.name} (${property.code ?? property.slug}) vừa được gửi để kiểm duyệt.`,
          })),
        });
      }
      return result;
    });
    return res.json(updated);
  });

  router.get('/properties/:id/room-types', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await ownedProperty(String(req.params.id), req.user!.id);
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    const rooms = await prisma.room.findMany({ where: { propertyId: property.id }, orderBy: { createdAt: 'asc' } });
    return res.json(rooms.map((room) => ({
      ...room,
      basePrice: Number(room.basePrice),
      weekendPrice: room.weekendPrice === null ? null : Number(room.weekendPrice),
      holidayPrice: room.holidayPrice === null ? null : Number(room.holidayPrice),
    })));
  });

  router.post('/properties/:id/room-types', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await ownedProperty(String(req.params.id), req.user!.id);
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    const parsed = roomInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Thông tin loại phòng chưa hợp lệ.', issues: parsed.error.flatten() });
    try {
      const room = await prisma.room.create({
        data: { ...parsed.data, basePrice: new Prisma.Decimal(parsed.data.basePrice), weekendPrice: parsed.data.weekendPrice == null ? null : new Prisma.Decimal(parsed.data.weekendPrice), holidayPrice: parsed.data.holidayPrice == null ? null : new Prisma.Decimal(parsed.data.holidayPrice), propertyId: property.id },
      });
      return res.status(201).json(room);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ message: 'Mã loại phòng đã được sử dụng.' });
      }
      throw error;
    }
  });

  router.put('/room-types/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const room = await ownedRoom(String(req.params.id), req.user!.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy loại phòng trong cơ sở của bạn.' });
    const parsed = roomInputSchema.partial().safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
      return res.status(400).json({ message: 'Thông tin loại phòng chưa hợp lệ.', issues: parsed.success ? undefined : parsed.error.flatten() });
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
      const updated = await prisma.room.update({ where: { id: room.id }, data });
      return res.json(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ message: 'Mã loại phòng đã được sử dụng.' });
      }
      throw error;
    }
  });

  router.delete('/room-types/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const room = await ownedRoom(String(req.params.id), req.user!.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy loại phòng trong cơ sở của bạn.' });
    const bookings = await prisma.booking.count({ where: { roomId: room.id } });
    if (bookings) return res.status(409).json({ message: 'Không thể xóa loại phòng đã có đơn đặt; hãy tạm ngừng bán phòng.' });
    await prisma.room.delete({ where: { id: room.id } });
    return res.json({ message: 'Đã xóa loại phòng.' });
  });

  router.post('/properties/:id/images', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await ownedProperty(String(req.params.id), req.user!.id);
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    const parsed = z.object({ url: z.string().url().max(2048), cover: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'URL ảnh chưa hợp lệ.' });
    const images = property.images.filter((url) => url !== parsed.data.url);
    if (parsed.data.cover) images.unshift(parsed.data.url);
    else images.push(parsed.data.url);
    const updated = await prisma.property.update({ where: { id: property.id }, data: { images: images.slice(0, 30) } });
    return res.json(updated.images);
  });

  router.delete('/properties/:id/images', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const property = await ownedProperty(String(req.params.id), req.user!.id);
    if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
    const parsed = z.object({ url: z.string().url() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'URL ảnh chưa hợp lệ.' });
    const updated = await prisma.property.update({ where: { id: property.id }, data: { images: property.images.filter((url) => url !== parsed.data.url) } });
    return res.json(updated.images);
  });

  router.delete('/images/:id', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const parsed = z.object({ url: z.string().url(), target: z.enum(['PROPERTY', 'ROOM']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Thông tin ảnh chưa hợp lệ.' });
    if (parsed.data.target === 'PROPERTY') {
      const property = await ownedProperty(String(req.params.id), req.user!.id);
      if (!property) return res.status(404).json({ message: 'Không tìm thấy cơ sở lưu trú của bạn.' });
      const updated = await prisma.property.update({
        where: { id: property.id },
        data: { images: property.images.filter((image) => image !== parsed.data.url) },
      });
      return res.json(updated.images);
    }
    const room = await ownedRoom(String(req.params.id), req.user!.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy loại phòng trong cơ sở của bạn.' });
    const updated = await prisma.room.update({
      where: { id: room.id },
      data: { images: room.images.filter((image) => image !== parsed.data.url) },
    });
    return res.json(updated.images);
  });

  router.get('/room-types/:id/availability', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const room = await ownedRoom(String(req.params.id), req.user!.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy loại phòng trong cơ sở của bạn.' });
    const parsed = calendarRangeSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Khoảng ngày không hợp lệ.' });
    const from = new Date(`${parsed.data.from}T00:00:00.000Z`);
    const toExclusive = new Date(new Date(`${parsed.data.to}T00:00:00.000Z`).getTime() + 86400000);
    const [overrides, bookings] = await Promise.all([
      prisma.roomAvailability.findMany({ where: { roomId: room.id, date: { gte: from, lt: toExclusive } } }),
      prisma.booking.findMany({
        where: { roomId: room.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkIn: { lt: toExclusive }, checkOut: { gt: from } },
        select: { checkIn: true, checkOut: true, roomCount: true },
      }),
    ]);
    const byDate = new Map(overrides.map((entry) => [entry.date.toISOString().slice(0, 10), entry.status]));
    const days = [];
    for (let cursor = from.getTime(); cursor < toExclusive.getTime(); cursor += 86400000) {
      const day = new Date(cursor);
      const dayEnd = new Date(cursor + 86400000);
      const booked = bookings.filter((booking) => booking.checkIn < dayEnd && booking.checkOut > day)
        .reduce((sum, booking) => sum + booking.roomCount, 0);
      const status = byDate.get(day.toISOString().slice(0, 10)) ?? 'OPEN';
      days.push({ date: day.toISOString().slice(0, 10), status, bookedRooms: booked, remainingRooms: status === 'OPEN' ? Math.max(0, room.availableRooms - booked) : 0 });
    }
    return res.json({ roomId: room.id, availableRooms: room.availableRooms, days });
  });

  router.put('/room-types/:id/availability', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const room = await ownedRoom(String(req.params.id), req.user!.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy loại phòng trong cơ sở của bạn.' });
    const parsed = z.object({ date: dateOnly, status: z.enum(['OPEN', 'CLOSED', 'MAINTENANCE']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Ngày hoặc trạng thái phòng chưa hợp lệ.' });
    const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
    try {
      const entry = await prisma.$transaction(async (tx) => {
        if (parsed.data.status !== 'OPEN') {
          const booking = await tx.booking.findFirst({
            where: { roomId: room.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkIn: { lt: new Date(date.getTime() + 86400000) }, checkOut: { gt: date } },
            select: { id: true },
          });
          if (booking) throw new Error('DATE_HAS_BOOKING');
        }
        return tx.roomAvailability.upsert({
          where: { roomId_date: { roomId: room.id, date } },
          create: { roomId: room.id, date, status: parsed.data.status },
          update: { status: parsed.data.status },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return res.json(entry);
    } catch (error) {
      if (error instanceof Error && error.message === 'DATE_HAS_BOOKING') {
        return res.status(409).json({ message: 'Ngày này đã có khách đặt, không thể đóng phòng.' });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return res.status(409).json({ message: 'Lịch phòng vừa thay đổi. Tải lại và thử lại.' });
      }
      throw error;
    }
  });

  router.get('/room-types/:id/pricing', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const room = await ownedRoom(String(req.params.id), req.user!.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy loại phòng trong cơ sở của bạn.' });
    const parsed = calendarRangeSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Khoảng ngày không hợp lệ.' });
    const from = new Date(`${parsed.data.from}T00:00:00.000Z`);
    const toExclusive = new Date(new Date(`${parsed.data.to}T00:00:00.000Z`).getTime() + 86400000);
    const prices = await prisma.roomPrice.findMany({ where: { roomId: room.id, date: { gte: from, lt: toExclusive } } });
    return res.json({
      basePrice: Number(room.basePrice),
      weekendPrice: room.weekendPrice === null ? null : Number(room.weekendPrice),
      holidayPrice: room.holidayPrice === null ? null : Number(room.holidayPrice),
      prices: prices.map((entry) => ({ date: entry.date.toISOString().slice(0, 10), price: Number(entry.price), kind: entry.kind })),
    });
  });

  router.put('/room-types/:id/pricing', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
    const room = await ownedRoom(String(req.params.id), req.user!.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy loại phòng trong cơ sở của bạn.' });
    const parsed = z.object({
      date: dateOnly,
      price: z.coerce.number().min(1000).max(1000000000).nullable(),
      kind: z.enum(['CUSTOM', 'HOLIDAY']).default('CUSTOM'),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Ngày hoặc giá phòng chưa hợp lệ.' });
    const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
    if (parsed.data.kind === 'CUSTOM' && parsed.data.price === null) {
      await prisma.roomPrice.deleteMany({ where: { roomId: room.id, date } });
      return res.json({ date: parsed.data.date, price: null });
    }
    if (parsed.data.kind === 'HOLIDAY' && room.holidayPrice === null) {
      return res.status(400).json({ message: 'Thiết lập giá ngày lễ trong thông tin loại phòng trước.' });
    }
    if (parsed.data.kind === 'CUSTOM' && parsed.data.price === null) {
      return res.status(400).json({ message: 'Nhập giá riêng hoặc chọn dùng giá ngày lễ.' });
    }
    const effectivePrice = parsed.data.kind === 'HOLIDAY' ? room.holidayPrice! : parsed.data.price!;
    const entry = await prisma.roomPrice.upsert({
      where: { roomId_date: { roomId: room.id, date } },
      create: { roomId: room.id, date, price: effectivePrice, kind: parsed.data.kind },
      update: { price: effectivePrice, kind: parsed.data.kind },
    });
    return res.json({ date: parsed.data.date, price: Number(entry.price), kind: entry.kind });
  });

router.get('/bookings', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { room: { property: { hostId: req.user!.id } } },
    include: { room: { include: { property: true } }, user: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
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

router.patch('/bookings/:id/stay-status', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const parsed = z.object({ status: z.enum(['CHECKED_IN', 'CHECKED_OUT']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid stay status.' });

  const booking = await prisma.booking.findUnique({
    where: { id: String(req.params.id) },
    include: { room: { include: { property: true } } },
  });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.room.property.hostId !== req.user!.id) {
    return res.status(403).json({ message: 'You can only manage stays for your own properties.' });
  }
  const validTransition = parsed.data.status === 'CHECKED_IN'
    ? booking.status === 'CONFIRMED'
    : booking.status === 'CHECKED_IN';
  if (!validTransition) {
    return res.status(409).json({ message: 'The booking is not in a state that allows this stay update.' });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: parsed.data.status },
  });
  return res.json(updated);
});

router.get('/notifications', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return res.json(notifications);
});

router.patch('/notifications/:id/read', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: req.user!.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (notification.count === 0) return res.status(404).json({ message: 'Unread notification not found.' });
  return res.json({ ok: true });
});

router.patch('/rooms/:id/inventory', requireAuth, requireRoles('HOST'), requireApprovedHost, async (req: AuthRequest, res) => {
  const parsed = z.object({
    availableRooms: z.coerce.number().int().min(0).max(500),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid room inventory.' });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: { id: String(req.params.id), property: { hostId: req.user!.id } },
      });
      if (!room) throw new Error('ROOM_NOT_FOUND');
      if (parsed.data.availableRooms < room.availableRooms) {
        const overlapping = await tx.booking.findMany({
          where: {
            roomId: room.id,
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
            checkOut: { gt: new Date() },
          },
          select: { checkIn: true, checkOut: true, roomCount: true },
        });
        if (getPeakBookedRooms(overlapping) > parsed.data.availableRooms) {
          throw new Error('INVENTORY_BELOW_BOOKINGS');
        }
      }

      return tx.room.update({
        where: { id: room.id },
        data: { availableRooms: parsed.data.availableRooms, ...(parsed.data.status ? { status: parsed.data.status } : {}) },
      });
    }, { isolationLevel: 'Serializable' });
    return res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
      return res.status(404).json({ message: 'Room not found in your properties.' });
    }
    if (error instanceof Error && error.message === 'INVENTORY_BELOW_BOOKINGS') {
      return res.status(409).json({ message: 'Inventory cannot be reduced below already-booked rooms.' });
    }
    if (error instanceof Error && 'code' in error && error.code === 'P2034') {
      return res.status(409).json({ message: 'Inventory changed while updating. Refresh and retry.' });
    }
    throw error;
  }
});

export default router;
