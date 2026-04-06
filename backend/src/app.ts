import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';

// Routes
import authRoutes from './modules/auth/auth.routes';
import restaurantRoutes from './modules/restaurants/restaurant.routes';
import userRoutes from './modules/users/user.routes';
import tableRoutes from './modules/tables/table.routes';
import menuRoutes from './modules/menu/menu.routes';
import orderRoutes from './modules/orders/order.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import floorPlanRoutes from './modules/floor-plan/floorPlan.routes';
import pushSubscriptionRoutes from './modules/push-subscriptions/pushSubscription.routes';
import customerRoutes from './modules/customers/customer.routes';

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: [env.ADMIN_APP_URL, env.CUSTOMER_APP_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Logging
if (env.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(globalRateLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
const apiV1 = '/api/v1';
app.use(`${apiV1}/auth`, authRoutes);
app.use(`${apiV1}/restaurants`, restaurantRoutes);
app.use(`${apiV1}/users`, userRoutes);
app.use(`${apiV1}/tables`, tableRoutes);
app.use(`${apiV1}/menu`, menuRoutes);
app.use(`${apiV1}/orders`, orderRoutes);
app.use(`${apiV1}/notifications`, notificationRoutes);
app.use(`${apiV1}/floor-plan`, floorPlanRoutes);
app.use(`${apiV1}/push-subscriptions`, pushSubscriptionRoutes);
app.use(`${apiV1}/customers`, customerRoutes);

// 404
app.use(notFoundMiddleware);

// Error handler
app.use(errorMiddleware);

export default app;
