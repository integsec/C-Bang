/** Collections module — methods available on built-in collection types. */
export const COLLECTIONS_MODULE = {
  name: 'collections',
  types: [
    {
      name: 'Vec',
      methods: [
        { name: 'push', params: ['item: T'], returnType: 'void', jsImpl: '.push' },
        { name: 'pop', params: [], returnType: 'Option<T>', jsImpl: '.pop' },
        { name: 'len', params: [], returnType: 'usize', jsImpl: '.length' },
        { name: 'is_empty', params: [], returnType: 'bool', jsImpl: '((v) => v.length === 0)' },
        { name: 'contains', params: ['item: &T'], returnType: 'bool', jsImpl: '.includes' },
        { name: 'iter', params: [], returnType: 'Iterator<T>', jsImpl: '.values' },
        { name: 'map', params: ['f: fn(T) -> U'], returnType: 'Vec<U>', jsImpl: '.map' },
        { name: 'filter', params: ['f: fn(&T) -> bool'], returnType: 'Vec<T>', jsImpl: '.filter' },
      ],
    },
    {
      name: 'Map',
      methods: [
        { name: 'get', params: ['key: K'], returnType: 'Option<V>', jsImpl: '.get' },
        { name: 'set', params: ['key: K', 'value: V'], returnType: 'void', jsImpl: '.set' },
        { name: 'has', params: ['key: K'], returnType: 'bool', jsImpl: '.has' },
        { name: 'delete', params: ['key: K'], returnType: 'bool', jsImpl: '.delete' },
        { name: 'len', params: [], returnType: 'usize', jsImpl: '.size' },
        { name: 'keys', params: [], returnType: 'Iterator<K>', jsImpl: '.keys' },
        { name: 'values', params: [], returnType: 'Iterator<V>', jsImpl: '.values' },
      ],
    },
  ],
} as const;
