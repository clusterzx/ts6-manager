import { Router, Request, Response, NextFunction } from 'express';

export const musicRequestRoutes: Router = Router({ mergeParams: true });

musicRequestRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const configId = parseInt(req.params.configId as string);
        if (isNaN(configId)) return res.status(400).json({ error: 'Invalid config id' });

        const requests = await req.app.locals.prisma.musicRequest.findMany({
            where: { serverConfigId: configId },
            orderBy: { requestedAt: 'desc' },
            take: 100,
        });

        res.json(requests);
    } catch (error) {
        next(error);
    }
});
