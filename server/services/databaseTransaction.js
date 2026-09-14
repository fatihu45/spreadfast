// Use one MongoDB session for every operation in a financial transaction.
function mongoTransaction(mongoose, models) {
  return async work => {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const tx = Object.fromEntries(Object.entries(models).map(([name, model]) => [name, {
          findOne: query => model.findOne(query).session(session),
          find: (query, projection) => model.find(query, projection).session(session),
          updateOne: (query, update) => model.updateOne(query, update, {session}),
          create: async doc => (await model.create([doc], {session}))[0]
        }]));
        return work(tx);
      });
    } finally { await session.endSession(); }
  };
}
module.exports = {mongoTransaction};
