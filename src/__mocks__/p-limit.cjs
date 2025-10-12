function pLimit(concurrency) {
  return async (fn, ...args) => {
    return fn(...args);
  };
}

module.exports = pLimit;
module.exports.pLimit = pLimit;
