export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function map(n, start1, stop1, start2, stop2, withinbounds = false) {
  let v = ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;

  if (withinbounds) {
    v = clamp(v, start2, stop2);
  }

  return v;
}
