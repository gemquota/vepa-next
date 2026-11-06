export class SplitMix32 {
  constructor(seed) {
    this.state = seed | 0;
  }

  nextUint32() {
    let z = (this.state + 0x9e3779b9) | 0;
    this.state = z;
    z = (z ^ (z >>> 16)) | 0;
    z = Math.imul(z, 0x21f0aaad);
    z = z ^ (z >>> 15);
    z = Math.imul(z, 0x735a2d97);
    z = z ^ (z >>> 15);
    return z >>> 0;
  }

  next() {
    return this.nextUint32() / 4294967296;
  }

  snapshot() {
    return Object.freeze({ algorithm: 'splitmix32-v1', state: this.state >>> 0 });
  }

  restore(snapshot) {
    if (!snapshot || snapshot.algorithm !== 'splitmix32-v1' || !Number.isInteger(snapshot.state)
      || snapshot.state < -2147483648 || snapshot.state > 0xffffffff) {
      throw new TypeError('Invalid SplitMix32 checkpoint');
    }
    this.state = snapshot.state | 0;
    return this;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }
}

export function createProductRandomAdapter({ seed = 0, state = seed } = {}) {
  const stream = new SplitMix32(seed).restore({ algorithm: 'splitmix32-v1', state });
  const adapter = {
    next: () => stream.next(),
    nextUint32: () => stream.nextUint32(),
    snapshot: () => stream.snapshot(),
    restore: checkpoint => { stream.restore(checkpoint); return adapter; },
    get state() { return stream.state >>> 0; },
  };
  return Object.freeze(adapter);
}
