export function nano(): number {
  const hrTime = process.hrtime();
  return hrTime[0] * 1e9 + hrTime[1];
}
