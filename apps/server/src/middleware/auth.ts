import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/tokens.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = verifyToken<{ id: string; email: string; role: string }>(token);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const requireRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }

    return next();
  };
};

export const requireApprovedHost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { hostApplication: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (user.role !== 'HOST') {
      return res.status(403).json({ message: 'Host access is restricted to approved host accounts.' });
    }

    if (!user.hostApplication || user.hostApplication.status !== 'APPROVED') {
      return res.status(403).json({ message: 'Host account is pending admin approval.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch {
    return res.status(500).json({ message: 'Unable to verify host approval status.' });
  }
};
