export function now() {
  return window.performance 
    ? window.performance.now() / 1000
    : Date.now() / 1000;
}

export function fill(array, value) {
  if (array.fill) {
    array.fill(value);
  }
  else {
    for (var i = 0; i < array.length; i++) {
      array[i] = value;
    }
  }
}