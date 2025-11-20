import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
};

export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateApiKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const verifyToken = (token: string, secret: string = process.env.JWT_SECRET!): any => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateToken = (userId: string, workplaceId?: string): string => {
  const payload: any = { id: userId };
  if (workplaceId) {
    payload.workplaceId = workplaceId;
  }
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
};