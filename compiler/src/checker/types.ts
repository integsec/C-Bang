/**
 * Internal type representations for the C! type checker.
 */

export type Type =
  | { kind: 'Primitive'; name: string }
  | { kind: 'Unit' }
  | { kind: 'Function'; params: Type[]; ret: Type }
  | { kind: 'Struct'; name: string; fields: Map<string, Type> }
  | { kind: 'Union'; name: string; variants: Map<string, Type | null> }
  | { kind: 'Generic'; name: string; args: Type[] }
  | { kind: 'Unknown' }
  | { kind: 'Never' };

export const PRIMITIVES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
  'f32', 'f64',
  'bool',
  'String',
]);

export const NUMERIC_TYPES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
  'f32', 'f64',
]);

export const INTEGER_TYPES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128',
  'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
]);

export const FLOAT_TYPES = new Set(['f32', 'f64']);

export function typeEquals(a: Type, b: Type): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'Primitive': return a.name === (b as typeof a).name;
    case 'Unit': return true;
    case 'Never': return true;
    case 'Unknown': return true;
    case 'Struct': return a.name === (b as typeof a).name;
    case 'Union': return a.name === (b as typeof a).name;
    case 'Generic': {
      const bg = b as typeof a;
      return a.name === bg.name
        && a.args.length === bg.args.length
        && a.args.every((arg, i) => typeEquals(arg, bg.args[i]!));
    }
    case 'Function': {
      const bf = b as typeof a;
      return bf.params.length === a.params.length
        && a.params.every((p, i) => typeEquals(p, bf.params[i]!))
        && typeEquals(a.ret, bf.ret);
    }
  }
}

export function typeToString(t: Type): string {
  switch (t.kind) {
    case 'Primitive': return t.name;
    case 'Unit': return '()';
    case 'Unknown': return '<unknown>';
    case 'Never': return 'never';
    case 'Struct': return t.name;
    case 'Union': return t.name;
    case 'Generic': return `${t.name}<${t.args.map(typeToString).join(', ')}>`;
    case 'Function': return `fn(${t.params.map(typeToString).join(', ')}) -> ${typeToString(t.ret)}`;
  }
}
