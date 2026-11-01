import { describe, it, expect } from 'vitest';
import {
  formatShort,
  decimalsOf,
  positionForValue,
  valueForPosition,
  snapToStep,
  zoomWindow,
  defaultLogMode,
  formatValue,
  ZOOM_FACTORS,
} from '../../src/ui/sliderControl.js';

describe('formatShort', () => {
  it('uses K/M shortforms for large magnitudes', () => {
    expect(formatShort(20000)).toBe('20K');
    expect(formatShort(2500)).toBe('2.5K');
    expect(formatShort(12345)).toBe('12.3K');
    expect(formatShort(1000)).toBe('1K');
    expect(formatShort(1500000)).toBe('1.5M');
    expect(formatShort(1000000)).toBe('1M');
  });

  it('keeps small values readable and strips trailing zeros', () => {
    expect(formatShort(999)).toBe('999');
    expect(formatShort(0.05)).toBe('0.05');
    expect(formatShort(1.5)).toBe('1.5');
    expect(formatShort(0)).toBe('0');
  });

  it('handles negatives', () => {
    expect(formatShort(-20000)).toBe('-20K');
    expect(formatShort(-0.5)).toBe('-0.5');
  });
});

describe('decimalsOf', () => {
  it('derives decimal places from the step string', () => {
    expect(decimalsOf(0.05)).toBe(2);
    expect(decimalsOf(0.001)).toBe(3);
    expect(decimalsOf(6.25)).toBe(2);
    expect(decimalsOf(100)).toBe(0);
    expect(decimalsOf(1e-7)).toBe(7);
  });

  it('returns 0 for non-positive or non-finite steps', () => {
    expect(decimalsOf(0)).toBe(0);
    expect(decimalsOf(-1)).toBe(0);
    expect(decimalsOf(NaN)).toBe(0);
  });
});

describe('positionForValue / valueForPosition', () => {
  it('round-trips in linear mode', () => {
    expect(positionForValue(5, { min: 0, max: 10 })).toBeCloseTo(0.5, 10);
    expect(valueForPosition(0.25, { min: 0, max: 10 })).toBeCloseTo(2.5, 10);
    expect(valueForPosition(positionForValue(7.5, { min: 0, max: 10 }), { min: 0, max: 10 })).toBeCloseTo(7.5, 8);
  });

  it('maps logarithmically when mode is log', () => {
    expect(positionForValue(10, { min: 1, max: 1000 }, 'log')).toBeCloseTo(1 / 3, 6);
    expect(valueForPosition(0.5, { min: 1, max: 1000 }, 'log')).toBeCloseTo(31.6227766, 5);
  });

  it('clamps out-of-range input', () => {
    expect(positionForValue(50, { min: 0, max: 10 })).toBe(1);
    expect(positionForValue(-5, { min: 0, max: 10 })).toBe(0);
    expect(valueForPosition(2, { min: 0, max: 10 })).toBe(10);
    expect(valueForPosition(-1, { min: 0, max: 10 })).toBe(0);
  });

  it('treats a degenerate window safely', () => {
    expect(positionForValue(3, { min: 5, max: 5 })).toBe(0);
    expect(valueForPosition(0.5, { min: 5, max: 5 })).toBe(5);
  });
});

describe('snapToStep', () => {
  it('snaps to the step grid anchored at the given value', () => {
    expect(snapToStep(995, 100, 50)).toBe(950);
    expect(snapToStep(1050, 100, 50)).toBe(1050);
    expect(snapToStep(7.5, 1, 0)).toBe(8);
  });

  it('avoids float noise on fractional steps', () => {
    expect(snapToStep(0.35, 0.1, 0)).toBe(0.4);
    expect(snapToStep(0.34, 0.1, 0)).toBe(0.3);
  });

  it('returns the value unchanged when there is no step', () => {
    expect(snapToStep(7.5, 0, 0)).toBe(7.5);
    expect(snapToStep(7.5, NaN, 0)).toBe(7.5);
  });
});

describe('zoomWindow', () => {
  it('returns the full range at level 0', () => {
    expect(zoomWindow(0, 100, 50, 0)).toEqual({ min: 0, max: 100 });
  });

  it('shows 1/4 of the range centered on the value at level 1', () => {
    expect(zoomWindow(0, 100, 50, 1)).toEqual({ min: 37.5, max: 62.5 });
  });

  it('shows 1/16 of the range at level 2', () => {
    expect(zoomWindow(0, 100, 50, 2)).toEqual({ min: 46.875, max: 53.125 });
  });

  it('clamps the window to the base range at the edges', () => {
    expect(zoomWindow(0, 100, 95, 1)).toEqual({ min: 82.5, max: 100 });
    expect(zoomWindow(0, 100, 5, 1)).toEqual({ min: 0, max: 17.5 });
  });

  it('matches the world-size scale (50..20000)', () => {
    const win = zoomWindow(50, 20000, 1000, 1);
    expect(win.min).toBe(50); // clamped to the base minimum
    expect(win.max).toBeCloseTo(3493.75, 6);
  });
});

describe('defaultLogMode', () => {
  it('prefers log for wide positive ranges', () => {
    expect(defaultLogMode(50, 20000)).toBe(true);
    expect(defaultLogMode(1, 1000)).toBe(true);
    expect(defaultLogMode(10, 5000)).toBe(true);
  });

  it('stays linear for narrow or non-positive ranges', () => {
    expect(defaultLogMode(0, 100)).toBe(false);
    expect(defaultLogMode(-2, 2)).toBe(false);
    expect(defaultLogMode(0.05, 0.5)).toBe(false);
    expect(defaultLogMode(1, 20)).toBe(false);
  });
});

describe('formatValue', () => {
  it('formats to the step precision', () => {
    expect(formatValue(1000, 100)).toBe('1000');
    expect(formatValue(993.75, 6.25)).toBe('993.75');
    expect(formatValue(0.35, 0.001)).toBe('0.350');
  });
});

describe('ZOOM_FACTORS', () => {
  it('provides 1×, 4× and 16× magnification', () => {
    expect(ZOOM_FACTORS).toEqual([1, 4, 16]);
  });
});
