import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signRefreshToken, signToken, verifyRefreshToken } from '../lib/tokens.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(3).max(255).optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(255).nullable().optional(),
  avatarUrl: z.union([z.string().url().max(2048), z.literal(''), z.null()]).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6).max(128),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid registration payload.', issues: parsed.error.flatten() });
  }

  const { fullName, email, password, phone, address } = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      password: passwordHash,
      phone,
      address,
      role: 'USER',
    },
  });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });
  return res.status(201).json({
    token,
    refreshToken,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      address: user.address,
    },
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid login payload.' });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });
  return res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      address: user.address,
    },
  });
});

router.post('/refresh', async (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  try {
    const decoded = verifyRefreshToken<{ id: string; email: string; role: string }>(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    return res.json({ token });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { hostApplication: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    address: user.address,
    cccd: user.cccd,
    hostApplication: user.hostApplication,
  });
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid profile payload.', issues: parsed.error.flatten() });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ message: 'At least one profile field is required.' });
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...parsed.data,
      avatarUrl: parsed.data.avatarUrl === '' ? null : parsed.data.avatarUrl,
    },
    select: { id: true, fullName: true, email: true, role: true, avatarUrl: true, phone: true, address: true },
  });
  return res.json(updated);
});

router.patch('/password', requireAuth, async (req: AuthRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid password payload.', issues: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
    return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác.' });
  }

  const password = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password } });
  return res.json({ message: 'Đổi mật khẩu thành công.' });
});

export default router;
