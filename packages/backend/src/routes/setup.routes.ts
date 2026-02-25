import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppError } from '../middleware/error-handler.js';
import { validatePassword } from '../utils/validate-password.js';

export const setupRoutes: Router = Router();

// GET /api/setup/status — Check if initial setup is needed
setupRoutes.get('/status', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const userCount = await prisma.user.count();
    res.json({ needsSetup: userCount === 0 });
  } catch (err) { next(err); }
});

// POST /api/setup/init — Create the first admin user
setupRoutes.post('/init', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;

    // Only allow if no users exist
    const userCount = await prisma.user.count();
    if (userCount > 0) throw new AppError(403, 'Setup already completed');

    const { username, password, displayName } = req.body;
    if (!username || !password) throw new AppError(400, 'Username and password are required');

    const pwError = validatePassword(password);
    if (pwError) throw new AppError(400, pwError);

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName: displayName || username,
        role: 'admin',
      },
    });

    res.status(201).json({ success: true, message: 'Admin account created. You can now log in.' });
  } catch (err) { next(err); }
});
