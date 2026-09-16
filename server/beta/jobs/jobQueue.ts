import { BetaJob, BetaJobAttempt } from './jobTypes.js';

export interface BetaJobQueue {
  enqueue(job:BetaJob,attempt:BetaJobAttempt,runner:()=>Promise<void>):Promise<void>;
}

/**
 * PR-03 starts with a safe inline dispatcher while keeping execution behind a queue contract.
 * A durable external queue can replace this implementation without changing routes or UI.
 */
export const inlineBetaJobQueue:BetaJobQueue={
  async enqueue(_job,_attempt,runner){
    await runner();
  },
};
