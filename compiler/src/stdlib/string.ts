/** String module — string manipulation utilities. */
export const STRING_MODULE = {
  name: 'string',
  methods: [
    { name: 'len', params: [], returnType: 'usize', jsImpl: '.length' },
    { name: 'is_empty', params: [], returnType: 'bool', jsImpl: '((s) => s.length === 0)' },
    { name: 'contains', params: ['substr: &str'], returnType: 'bool', jsImpl: '.includes' },
    { name: 'starts_with', params: ['prefix: &str'], returnType: 'bool', jsImpl: '.startsWith' },
    { name: 'ends_with', params: ['suffix: &str'], returnType: 'bool', jsImpl: '.endsWith' },
    { name: 'to_uppercase', params: [], returnType: 'String', jsImpl: '.toUpperCase' },
    { name: 'to_lowercase', params: [], returnType: 'String', jsImpl: '.toLowerCase' },
    { name: 'trim', params: [], returnType: 'String', jsImpl: '.trim' },
    { name: 'split', params: ['sep: &str'], returnType: 'Vec<String>', jsImpl: '.split' },
    { name: 'replace', params: ['from: &str', 'to: &str'], returnType: 'String', jsImpl: '.replace' },
    { name: 'chars', params: [], returnType: 'Vec<char>', jsImpl: '((s) => [...s])' },
    { name: 'parse_int', params: [], returnType: 'Result<i64, ParseError>', jsImpl: 'parseInt' },
    { name: 'parse_float', params: [], returnType: 'Result<f64, ParseError>', jsImpl: 'parseFloat' },
  ],
} as const;
