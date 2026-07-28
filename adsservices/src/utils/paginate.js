async function paginate(Model, filter = {}, opts = {}) {
  const page = Math.max(parseInt(opts.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(opts.limit) || 20, 1), 200);
  const sort = opts.sort || { createdAt: -1 };
  let q = Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  if (opts.populate) q = q.populate(opts.populate);
  if (opts.select) q = q.select(opts.select);
  const [items, total] = await Promise.all([q.lean(opts.lean !== false), Model.countDocuments(filter)]);
  return { items, total, page, pages: Math.ceil(total / limit) || 1, limit };
}
module.exports = { paginate };
