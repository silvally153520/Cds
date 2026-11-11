import jwt, { type SignOptions } from 'jsonwebtoken';

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = getRequiredEnv('JWT_REFRESH_SECRET');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

export const signToken = (payload: object) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] });

export const signRefreshToken = (payload: object) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] });

export const verifyToken = <T>(token: string): T => {
  return jwt.verify(token, JWT_SECRET) as T;
};

export const verifyRefreshToken = <T>(token: string): T => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as T;
};
