/** Math module — numeric utilities. */
export const MATH_MODULE = {
  name: 'math',
  functions: [
    { name: 'abs', params: ['x: f64'], returnType: 'f64', jsImpl: 'Math.abs' },
    { name: 'sqrt', params: ['x: f64'], returnType: 'f64', jsImpl: 'Math.sqrt' },
    { name: 'floor', params: ['x: f64'], returnType: 'i64', jsImpl: 'Math.floor' },
    { name: 'ceil', params: ['x: f64'], returnType: 'i64', jsImpl: 'Math.ceil' },
    { name: 'round', params: ['x: f64'], returnType: 'i64', jsImpl: 'Math.round' },
    { name: 'min', params: ['a: f64', 'b: f64'], returnType: 'f64', jsImpl: 'Math.min' },
    { name: 'max', params: ['a: f64', 'b: f64'], returnType: 'f64', jsImpl: 'Math.max' },
    { name: 'pow', params: ['base: f64', 'exp: f64'], returnType: 'f64', jsImpl: 'Math.pow' },
    { name: 'random', params: [], returnType: 'f64', jsImpl: 'Math.random' },
  ],
  constants: [
    { name: 'PI', type: 'f64', jsImpl: 'Math.PI' },
    { name: 'E', type: 'f64', jsImpl: 'Math.E' },
    { name: 'INFINITY', type: 'f64', jsImpl: 'Infinity' },
  ],
} as const;
