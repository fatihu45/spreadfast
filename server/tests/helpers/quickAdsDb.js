// Deterministic transactional fixture: serialize transactions and roll back all writes on failure.
// Production uses MongoDB sessions, never this in-memory implementation.
function quickAdsDb(users = []) {
  let state = { User: structuredClone(users), QuickAdGeneration: [], PaystackTransaction: [] };
  let tail = Promise.resolve();
  const matches = (row, query) => Object.entries(query).every(([key, value]) => row[key] === value);
  const models = Object.fromEntries(Object.keys(state).map(name => [name, {
    async findOne(query) { return structuredClone(state[name].find(row => matches(row, query)) || null); },
    async find(query = {}) { return structuredClone(state[name].filter(row => matches(row, query))); },
    async create(doc) {
      if (state[name].some(row => row.id === doc.id || (doc.reference && row.reference === doc.reference))) throw Object.assign(new Error('Duplicate'), { code: 11000 });
      state[name].push(structuredClone(doc)); return structuredClone(doc);
    },
    async updateOne(query, update) {
      const row = state[name].find(row => matches(row, query));
      if (!row) return { matchedCount: 0, modifiedCount: 0 };
      for (const [key, value] of Object.entries(update)) {
        if (key === '$inc') for (const [field, amount] of Object.entries(value)) row[field] = (row[field] || 0) + amount;
        else if (key === '$set') Object.assign(row, structuredClone(value));
        else row[key] = structuredClone(value);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }
  }]));
  return { ...models,
    withTransaction(work) {
      const result = tail.then(async () => {
        const before = structuredClone(state);
        try { return await work(models); } catch (error) { state = before; throw error; }
      });
      tail = result.catch(() => {});
      return result;
    }
  };
}
module.exports = { quickAdsDb };
