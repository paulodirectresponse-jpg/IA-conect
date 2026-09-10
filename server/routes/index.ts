import { Router, json } from 'express';
import { runtimeRouter } from './runtimeRoutes.js';
import { creditRuntimeRouter } from './creditRuntimeRoutes.js';
import { providerFinanceRouter } from './providerFinanceRoutes.js';
import { adminPricingRuntimeRouter } from './adminPricingRuntimeRoutes.js';
import { adminEconomicsRouter } from './adminEconomicsRoutes.js';
import { communityRouter } from './communityRoutes.js';
import { generationRuntimeRouter } from './generationRuntimeRoutes.js';
import { apiRouter } from './apiRoutes.js';

export const apiRootRouter = Router();

apiRootRouter.use(json({ limit: '4mb' }));
apiRootRouter.use(runtimeRouter);
apiRootRouter.use(creditRuntimeRouter);
apiRootRouter.use(providerFinanceRouter);
apiRootRouter.use(adminPricingRuntimeRouter);
apiRootRouter.use(adminEconomicsRouter);
apiRootRouter.use(communityRouter);
apiRootRouter.use(generationRuntimeRouter);
apiRootRouter.use(apiRouter);
