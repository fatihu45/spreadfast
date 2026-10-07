// Deterministic transactional fixture: serialize transactions and roll back all writes on failure.
// Production uses MongoDB sessions, never this in-memory implementation.
function quickAdsDb(users = []) {
  let state = { User: structuredClone(users), QuickAdGeneration: [], PaystackTransaction: [], Withdrawal: [], EmailNotification: [] };
  let tail = Promise.resolve();
  const matches = (row, query) => Object.entries(query).every(([key, value]) => value && typeof value === 'object' && '$exists' in value ? (row[key] !== undefined) === value.$exists : row[key] === value);
  const buildCursor = rows => {
    const data = Array.from(rows);
    const chain = data;
    chain.sort = function(fields = {}) {
      const entries = Object.entries(fields);
      const clone = Array.from(this);
      clone.sort((a, b) => {
        for (const [key, direction] of entries) {
          const leftValue = a?.[key];
          const rightValue = b?.[key];
          const left = leftValue instanceof Date ? leftValue.getTime() : Number(leftValue ?? 0);
          const right = rightValue instanceof Date ? rightValue.getTime() : Number(rightValue ?? 0);
          if (Number.isNaN(left) || Number.isNaN(right)) {
            const fallback = String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
            if (fallback !== 0) return direction === -1 ? -fallback : fallback;
            continue;
          }
          if (left === right) continue;
          return direction === -1 ? (right > left ? 1 : -1) : (left > right ? 1 : -1);
        }
        return 0;
      });
      return buildCursor(clone);
    };
    chain.skip = function(count) {
      return buildCursor(Array.from(this).slice(Math.max(0, Number(count) || 0)));
    };
    chain.limit = function(count) {
      return buildCursor(Array.from(this).slice(0, Math.max(0, Number(count) || 0)));
    };
    return chain;
  };
  const models = Object.fromEntries(Object.keys(state).map(name => [name, {
    async findOne(query) { return structuredClone(state[name].find(row => matches(row, query)) || null); },
    find(query = {}) { return buildCursor(state[name].filter(row => matches(row, query)).map(row => structuredClone(row))); },
    async create(doc) {
      if (state[name].some(row => row.id === doc.id || (doc.reference && row.reference === doc.reference))) throw Object.assign(new Error('Duplicate'), { code: 11000 });
      const record = structuredClone(doc);
      const timestamp = Date.now() + state[name].length * 1000;
      if (!record.createdAt) record.createdAt = new Date(timestamp);
      if (!record.updatedAt) record.updatedAt = record.createdAt;
      state[name].push(record); return structuredClone(record);
    },
    async updateOne(query, update) {
      const row = state[name].find(row => matches(row, query));
      if (!row) return { matchedCount: 0, modifiedCount: 0 };
      for (const [key, value] of Object.entries(update)) {
        if (key === '$inc') for (const [field, amount] of Object.entries(value)) row[field] = (row[field] || 0) + amount;
        else if (key === '$set') for (const [field, entry] of Object.entries(value)) {
          const parts = field.split('.');
          let target = row;
          for (const part of parts.slice(0, -1)) target = target[part] ||= {};
          target[parts.at(-1)] = structuredClone(entry);
        }
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
