// Money helpers — all amounts are USD numbers with 2 decimals.
// round2 avoids float drift (e.g. 0.1 + 0.2).

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function sum(arr, pick = (x) => x) {
  return round2(arr.reduce((acc, x) => acc + Number(pick(x) || 0), 0));
}

module.exports = { round2, sum };
