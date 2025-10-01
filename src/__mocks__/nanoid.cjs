// Mock implementation of nanoid for testing (CommonJS)

function nanoid(size = 21) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function customAlphabet(alphabet, defaultSize = 21) {
  return function (size = defaultSize) {
    let result = '';
    for (let i = 0; i < size; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  };
}

function urlAlphabet(size = 21) {
  return nanoid(size);
}

async function nanoidAsync(size = 21) {
  return Promise.resolve(nanoid(size));
}

module.exports = {
  nanoid,
  customAlphabet,
  urlAlphabet,
  nanoidAsync,
};


