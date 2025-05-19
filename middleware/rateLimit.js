import rateLimit from 'express-rate-limit';

export const rateLimitWebhook = rateLimit({
  windowMs: 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 100 requests
  message: "Too many webhook requests, please try again later",
});