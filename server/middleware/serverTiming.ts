import { RequestHandler } from 'express';

export const serverTimingMiddleware: RequestHandler = (_req, res, next) => {
  const started = Date.now();
  const response = res as any;
  const originalJson = response.json.bind(res);
  const originalSend = response.send.bind(res);
  let stamped = false;

  const stamp = () => {
    if (stamped || res.headersSent) return;
    stamped = true;
    const duration = Math.max(0, Date.now() - started);
    res.setHeader('Server-Timing', `app;dur=${duration}`);
  };

  response.json = (body:any) => {
    stamp();
    return originalJson(body);
  };

  response.send = (body:any) => {
    stamp();
    return originalSend(body);
  };

  next();
};
