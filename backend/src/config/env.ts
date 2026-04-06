import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  CUSTOMER_APP_URL: process.env.CUSTOMER_APP_URL || 'http://localhost:5174',
  ADMIN_APP_URL: process.env.ADMIN_APP_URL || 'http://localhost:5173',
  isDev: process.env.NODE_ENV !== 'production',
  VAPID_PUBLIC_KEY: requireEnv('VAPID_PUBLIC_KEY'),
  VAPID_PRIVATE_KEY: requireEnv('VAPID_PRIVATE_KEY'),
  VAPID_MAILTO: process.env.VAPID_MAILTO || 'mailto:admin@commy.io',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
};
