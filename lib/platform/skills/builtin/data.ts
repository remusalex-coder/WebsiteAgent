/**
 * Data capabilities: persistence and retrieval.
 *
 * `vector-store` depends on `embeddings` rather than embedding text itself.
 * Keeping the two apart means the embedding model can be changed — or moved to
 * a different provider — without touching the store, and a caller that already
 * holds vectors is not forced through an embedding call it does not need.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const DATA_SKILLS: readonly AnySkill[] = definePlaceholders('data', [
  {
    id: 'embeddings',
    name: 'Embeddings',
    description: 'Turns text into vectors, batched, with the model recorded alongside them.',
    blockedOn: 'needs an embedding method on the AIProvider contract',
  },
  {
    id: 'vector-store',
    name: 'Vector store',
    description:
      'Stores and queries embeddings with metadata filtering, for semantic search over collected site content.',
    dependencies: ['embeddings'],
    blockedOn: 'needs a store chosen and a namespace-per-business decision',
  },
  {
    id: 'database',
    name: 'Database',
    description:
      'Parameterised queries, migrations and transactions against a relational database.',
    requiredCredentials: ['DATABASE_URL'],
    blockedOn: 'needs a driver and a migration strategy; nothing persists to SQL today',
  },
]);
