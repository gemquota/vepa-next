/** SplitMix32 stream with explicit serializable state. */
export class SplitMix32 {
  constructor(seed = 0) {
    this.state = Number(seed) >>> 0;
  }

  nextUint32() {
    this.state = (this.state + 0x9e3779b9) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  }

  next() {
    return this.nextUint32() / 0x100000000;
  }

  nextInt(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError('nextInt requires integers with max >= min');
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  nextFloat(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError('nextFloat requires finite bounds with max >= min');
    }
    return min + this.next() * (max - min);
  }

  snapshot() {
    return Object.freeze({ algorithm: 'splitmix32-v1', state: this.state >>> 0 });
  }

  restore(snapshot) {
    if (snapshot?.algorithm !== 'splitmix32-v1' || !Number.isInteger(snapshot.state)) {
      throw new TypeError('Unsupported or invalid PRNG snapshot');
    }
    this.state = snapshot.state >>> 0;
    return this;
  }
}
