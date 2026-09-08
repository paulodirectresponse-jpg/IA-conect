import { Generation, GenerationAttemptLog } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';

const generationsMap = new Map<string, Generation>();
const attemptsList: GenerationAttemptLog[] = [];

export const generationRepository = {
  async getGeneration(generationId: string): Promise<Generation | null> {
    let gen = generationsMap.get(generationId);
    if (!gen) {
      try {
        const db = getAdminDb();
        if (db) {
          const doc = await db.collection('generations').doc(generationId).get();
          if (doc.exists) {
            gen = doc.data() as Generation;
            generationsMap.set(generationId, gen);
          }
        }
      } catch {
        // Fallback
      }
    }
    return gen ? { ...gen } : null;
  },

  async saveGeneration(generation: Generation): Promise<Generation> {
    generationsMap.set(generation.generation_id, { ...generation });
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection('generations').doc(generation.generation_id).set(generation, { merge: true });
      }
    } catch {
      // Non-blocking
    }
    return { ...generation };
  },

  async listUserGenerations(userId: string, limit = 50): Promise<Generation[]> {
    // Try to sync with Firestore if cache is empty
    try {
      const db = getAdminDb();
      if (db) {
        const snap = await db.collection('generations')
          .where('user_id', '==', userId)
          .orderBy('created_at', 'desc')
          .limit(limit)
          .get();
        snap.forEach((doc) => {
          const item = doc.data() as Generation;
          generationsMap.set(item.generation_id, item);
        });
      }
    } catch {
      // Fallback to local
    }

    const list = Array.from(generationsMap.values())
      .filter((g) => g.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return list.slice(0, limit);
  },

  async listAllGenerations(limit = 50): Promise<Generation[]> {
    try {
      const db = getAdminDb();
      if (db) {
        const snap = await db.collection('generations')
          .orderBy('created_at', 'desc')
          .limit(limit)
          .get();
        snap.forEach((doc) => {
          const item = doc.data() as Generation;
          generationsMap.set(item.generation_id, item);
        });
      }
    } catch {
      // Fallback
    }

    const list = Array.from(generationsMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return list.slice(0, limit);
  },

  async recordAttemptLog(attempt: GenerationAttemptLog): Promise<GenerationAttemptLog> {
    attemptsList.push({ ...attempt });
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection('generation_attempts').doc(attempt.attempt_id).set(attempt);
      }
    } catch {
      // Non-blocking
    }
    return { ...attempt };
  },

  async getAttemptLogs(generationId: string): Promise<GenerationAttemptLog[]> {
    return attemptsList
      .filter((a) => a.generation_id === generationId)
      .sort((a, b) => a.attempt_number - b.attempt_number);
  },
};
