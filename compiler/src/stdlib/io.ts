/** Standard I/O module — runtime function signatures for the C! standard library. */
export const IO_MODULE = {
  name: 'io',
  functions: [
    { name: 'print', params: ['value: String'], returnType: 'void', jsImpl: 'console.log' },
    { name: 'println', params: ['value: String'], returnType: 'void', jsImpl: 'console.log' },
    { name: 'eprint', params: ['value: String'], returnType: 'void', jsImpl: 'console.error' },
    { name: 'eprintln', params: ['value: String'], returnType: 'void', jsImpl: 'console.error' },
    { name: 'read_line', params: [], returnType: 'String', jsImpl: '(() => prompt(""))' },
  ],
} as const;
