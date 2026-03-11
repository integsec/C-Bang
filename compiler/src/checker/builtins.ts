/**
 * Built-in types and functions for the C! type checker.
 */

import type { Environment } from './environment.js';
import { PRIMITIVES } from './types.js';

export function registerBuiltins(env: Environment): void {
  for (const name of PRIMITIVES) {
    env.defineType(name, { kind: 'Primitive', name });
  }
  env.defineType('()', { kind: 'Unit' });

  env.define('print', {
    kind: 'Function',
    params: [{ kind: 'Primitive', name: 'String' }],
    ret: { kind: 'Unit' },
  });

  env.define('println', {
    kind: 'Function',
    params: [{ kind: 'Primitive', name: 'String' }],
    ret: { kind: 'Unit' },
  });
}
