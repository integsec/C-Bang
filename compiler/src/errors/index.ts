/**
 * Error types and formatting for the C! compiler.
 */

import type { Span } from '../lexer/index.js';

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  span: Span;
  notes: string[];
  suggestion?: string | undefined;
}

export function formatDiagnostic(diagnostic: Diagnostic, source: string): string {
  const { severity, code, message, span, notes, suggestion } = diagnostic;
  const prefix = severity === 'error' ? 'ERROR' : severity === 'warning' ? 'WARN' : 'INFO';
  const lines = source.split('\n');
  const line = lines[span.start.line - 1] ?? '';

  let output = `${prefix}[${code}]: ${message}\n`;
  output += `  --> ${span.file}:${span.start.line}:${span.start.column}\n`;
  output += `   |\n`;
  output += `${String(span.start.line).padStart(3)} | ${line}\n`;

  // Underline
  const underlineStart = span.start.column - 1;
  const underlineLen = Math.max(1, span.end.column - span.start.column);
  output += `   | ${' '.repeat(underlineStart)}${'^'.repeat(underlineLen)}\n`;

  for (const note of notes) {
    output += `   = note: ${note}\n`;
  }

  if (suggestion) {
    output += `   = suggestion: ${suggestion}\n`;
  }

  return output;
}

export function createError(
  code: string,
  message: string,
  span: Span,
  options: { notes?: string[]; suggestion?: string } = {},
): Diagnostic {
  return {
    severity: 'error',
    code,
    message,
    span,
    notes: options.notes ?? [],
    suggestion: options.suggestion,
  };
}

export function createWarning(
  code: string,
  message: string,
  span: Span,
  options: { notes?: string[]; suggestion?: string } = {},
): Diagnostic {
  return {
    severity: 'warning',
    code,
    message,
    span,
    notes: options.notes ?? [],
    suggestion: options.suggestion,
  };
}
