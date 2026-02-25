import { Request, Response, NextFunction } from 'express';

/**
 * H9: Middleware to enforce per-server access control.
 * Admins bypass this check. Viewers must have a UserServerAccess record.
 */
export function requireServerAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Admins have access to all servers
    if (req.user?.role === 'admin') return next();

    const configId = parseInt(req.params.configId as string);
    if (isNaN(configId)) {
      res.status(400).json({ error: 'Invalid server config ID' });
      return;
    }

    const prisma = req.app.locals.prisma;
    const access = await prisma.userServerAccess.findUnique({
      where: {
        userId_serverConfigId: {
          userId: req.user!.id,
          serverConfigId: configId,
        },
      },
    });

    if (!access) {
      res.status(403).json({ error: 'No access to this server' });
      return;
    }

    next();
  };
}
