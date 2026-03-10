import { describe, it, expect } from 'vitest';
import { IO_MODULE, MATH_MODULE, COLLECTIONS_MODULE, STRING_MODULE, STDLIB_MODULES } from '../src/stdlib/index.js';

describe('Standard Library Modules', () => {
  it('exports all module names', () => {
    expect(STDLIB_MODULES).toEqual(['io', 'math', 'collections', 'string']);
  });

  describe('io module', () => {
    it('has print and println', () => {
      const names = IO_MODULE.functions.map(f => f.name);
      expect(names).toContain('print');
      expect(names).toContain('println');
    });

    it('maps println to console.log', () => {
      const println = IO_MODULE.functions.find(f => f.name === 'println');
      expect(println?.jsImpl).toBe('console.log');
    });
  });

  describe('math module', () => {
    it('has basic math functions', () => {
      const names = MATH_MODULE.functions.map(f => f.name);
      expect(names).toContain('abs');
      expect(names).toContain('sqrt');
      expect(names).toContain('min');
      expect(names).toContain('max');
    });

    it('has PI and E constants', () => {
      const names = MATH_MODULE.constants.map(c => c.name);
      expect(names).toContain('PI');
      expect(names).toContain('E');
    });
  });

  describe('collections module', () => {
    it('defines Vec type with methods', () => {
      const vec = COLLECTIONS_MODULE.types.find(t => t.name === 'Vec');
      expect(vec).toBeDefined();
      const methods = vec!.methods.map(m => m.name);
      expect(methods).toContain('push');
      expect(methods).toContain('pop');
      expect(methods).toContain('len');
      expect(methods).toContain('map');
      expect(methods).toContain('filter');
    });

    it('defines Map type with methods', () => {
      const map = COLLECTIONS_MODULE.types.find(t => t.name === 'Map');
      expect(map).toBeDefined();
      const methods = map!.methods.map(m => m.name);
      expect(methods).toContain('get');
      expect(methods).toContain('set');
      expect(methods).toContain('has');
    });
  });

  describe('string module', () => {
    it('has string manipulation methods', () => {
      const names = STRING_MODULE.methods.map(m => m.name);
      expect(names).toContain('len');
      expect(names).toContain('contains');
      expect(names).toContain('trim');
      expect(names).toContain('split');
      expect(names).toContain('to_uppercase');
    });
  });
});
