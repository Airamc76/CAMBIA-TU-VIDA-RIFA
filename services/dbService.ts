import { authRepository } from './auth.repository';
import { raffleRepository } from './raffle.repository';
import { purchaseRepository } from './purchase.repository';
import { adminRepository } from './admin.repository';

/**
 * dbService acts as a Facade for the new modular repositories
 * to maintain backward compatibility with existing components
 * without changing any imports.
 */
export const dbService = {
  ...authRepository,
  ...raffleRepository,
  ...purchaseRepository,
  ...adminRepository
};
