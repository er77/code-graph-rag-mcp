export function add(a: number, b: number): number {
  const total = a + b;
  if (total > 100) {
    return total - 100;
  }
  return total;
}

export function multiply(a: number, b: number): number {
  let result = 0;
  for (let i = 0; i < b; i++) {
    result += a;
  }
  return result;
}
