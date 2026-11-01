export class SplitMix32 {
  constructor(seed) {
    this.state = seed | 0;
  }

  next() {
    let z = (this.state + 0x9e3779b9) | 0;
    this.state = z;
    z = (z ^ (z >>> 16)) | 0;
    z = Math.imul(z, 0x21f0aaad);
    z = z ^ (z >>> 15);
    z = Math.imul(z, 0x735a2d97);
    z = z ^ (z >>> 15);
    return (z >>> 0) / 4294967296;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }
}
