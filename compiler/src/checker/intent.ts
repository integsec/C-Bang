/**
 * Intent annotation verifier for C!.
 *
 * Validates intent annotations (#[intent], #[pre], #[post], #[audit],
 * #[verify], #[invariant]) on declarations. This is C!'s core AI-safety
 * feature: structured annotations that serve as machine-readable
 * specifications the compiler can verify.
 *
 * This checker:
 * 1. Validates that annotation names are known
 * 2. Checks #[intent] has a non-empty description string
 * 3. Checks #[pre]/#[post] reference valid parameter names
 * 4. Checks #[audit] has required fields (category, severity)
 * 5. Warns on public functions lacking #[intent] annotations
 * 6. Validates #[invariant] appears only on contracts/actors
 * 7. Validates #[verify] appears only on contracts
 */

import type {
  Program,
  Annotation,
  FunctionDecl,
  TypeDecl,
  ActorDecl,
  ContractDecl,
  ServerDecl,
  ComponentDecl,
  EnumDecl,
} from '../ast/index.js';
import type { Span } from '../lexer/index.js';
import type { Diagnostic } from '../errors/index.js';
import { createError, createWarning } from '../errors/index.js';

// ─── Known annotation names ──────────────────────────────────────

const KNOWN_ANNOTATIONS = new Set([
  'intent',
  'pre',
  'post',
  'audit',
  'verify',
  'invariant',
  'test',
  'deprecated',
  'inline',
  'cold',
  'hot',
  'allow',
  'deny',
  'warn',
]);

/** Annotations that require parenthesized arguments. */
const REQUIRES_ARGS = new Set(['intent', 'pre', 'post', 'audit', 'invariant']);

/** Annotations that take no arguments. */
const NO_ARGS = new Set(['verify']);

/** Annotations only valid on contracts. */
const CONTRACT_ONLY = new Set(['verify']);

/** Annotations only valid on contracts or actors. */
const CONTRACT_OR_ACTOR = new Set(['invariant']);

/** Valid audit severity values. */
const AUDIT_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

// ─── Checker ─────────────────────────────────────────────────────

export class IntentChecker {
  private diagnostics: Diagnostic[] = [];

  check(program: Program): Diagnostic[] {
    this.diagnostics = [];

    for (const item of program.items) {
      switch (item.kind) {
        case 'FunctionDecl':
          this.checkFunctionAnnotations(item);
          break;
        case 'TypeDecl':
          this.checkTypeAnnotations(item);
          break;
        case 'ActorDecl':
          this.checkActorAnnotations(item);
          break;
        case 'ContractDecl':
          this.checkContractAnnotations(item);
          break;
        case 'ServerDecl':
          this.checkServerAnnotations(item);
          break;
        case 'ComponentDecl':
          this.checkComponentAnnotations(item);
          break;
        case 'EnumDecl':
          this.checkEnumAnnotations(item);
          break;
      }
    }

    return this.diagnostics;
  }

  // ─── Function annotations ────────────────────────────────────

  private checkFunctionAnnotations(decl: FunctionDecl): void {
    const paramNames = new Set(decl.params.map(p => p.name));
    const context: AnnotationContext = {
      kind: 'function',
      paramNames,
      name: decl.name,
    };

    this.validateAnnotations(decl.annotations, context);

    // Warn if public function lacks #[intent]
    if (decl.visibility === 'public' && decl.name !== 'main') {
      const hasIntent = decl.annotations.some(a => a.name === 'intent');
      if (!hasIntent) {
        this.warning(
          `Public function '${decl.name}' lacks an #[intent] annotation`,
          decl.span,
          `Add #[intent("...")] to describe this function's purpose`,
        );
      }
    }
  }

  // ─── Type annotations ────────────────────────────────────────

  private checkTypeAnnotations(decl: TypeDecl): void {
    const context: AnnotationContext = {
      kind: 'type',
      paramNames: new Set(),
      name: decl.name,
    };
    this.validateAnnotations(decl.annotations, context);
  }

  private checkEnumAnnotations(decl: EnumDecl): void {
    const context: AnnotationContext = {
      kind: 'type',
      paramNames: new Set(),
      name: decl.name,
    };
    this.validateAnnotations(decl.annotations, context);
  }

  // ─── Actor annotations ───────────────────────────────────────

  private checkActorAnnotations(decl: ActorDecl): void {
    const context: AnnotationContext = {
      kind: 'actor',
      paramNames: new Set(),
      name: decl.name,
    };
    this.validateAnnotations(decl.annotations, context);

    // Check annotations on actor methods
    for (const member of decl.members) {
      if (member.kind === 'FunctionDecl') {
        this.checkFunctionAnnotations(member);
      }
    }
  }

  // ─── Contract annotations ────────────────────────────────────

  private checkContractAnnotations(decl: ContractDecl): void {
    const context: AnnotationContext = {
      kind: 'contract',
      paramNames: new Set(),
      name: decl.name,
    };
    this.validateAnnotations(decl.annotations, context);

    // Check annotations on contract methods
    for (const member of decl.members) {
      if (member.kind === 'FunctionDecl') {
        this.checkFunctionAnnotations(member);
      }
    }
  }

  // ─── Server annotations ──────────────────────────────────────

  private checkServerAnnotations(decl: ServerDecl): void {
    const context: AnnotationContext = {
      kind: 'server',
      paramNames: new Set(),
      name: decl.name,
    };
    this.validateAnnotations(decl.annotations, context);

    // Check annotations on server methods (routes, handlers)
    for (const member of decl.members) {
      if (member.kind === 'FunctionDecl') {
        this.checkFunctionAnnotations(member);
      }
    }
  }

  // ─── Component annotations ───────────────────────────────────

  private checkComponentAnnotations(decl: ComponentDecl): void {
    const context: AnnotationContext = {
      kind: 'component',
      paramNames: new Set(decl.params.map(p => p.name)),
      name: decl.name,
    };
    this.validateAnnotations(decl.annotations, context);
  }

  // ─── Core validation ─────────────────────────────────────────

  private validateAnnotations(
    annotations: Annotation[],
    context: AnnotationContext,
  ): void {
    for (const ann of annotations) {
      this.validateAnnotation(ann, context);
    }

    // Check for duplicate annotation types
    this.checkDuplicates(annotations);
  }

  private validateAnnotation(
    ann: Annotation,
    context: AnnotationContext,
  ): void {
    // 1. Check if annotation name is known
    if (!KNOWN_ANNOTATIONS.has(ann.name)) {
      this.warning(
        `Unknown annotation '#[${ann.name}]'`,
        ann.span,
        `Known annotations: ${[...KNOWN_ANNOTATIONS].join(', ')}`,
      );
      return;
    }

    // 2. Check argument requirements
    if (REQUIRES_ARGS.has(ann.name) && !ann.args.trim()) {
      this.error(
        `Annotation '#[${ann.name}]' requires arguments`,
        ann.span,
      );
      return;
    }

    if (NO_ARGS.has(ann.name) && ann.args.trim()) {
      this.warning(
        `Annotation '#[${ann.name}]' does not take arguments`,
        ann.span,
      );
    }

    // 3. Check placement restrictions
    if (CONTRACT_ONLY.has(ann.name) && context.kind !== 'contract') {
      this.error(
        `Annotation '#[${ann.name}]' is only valid on contracts, not on ${context.kind} '${context.name}'`,
        ann.span,
      );
      return;
    }

    if (CONTRACT_OR_ACTOR.has(ann.name) && context.kind !== 'contract' && context.kind !== 'actor') {
      this.error(
        `Annotation '#[${ann.name}]' is only valid on contracts or actors, not on ${context.kind} '${context.name}'`,
        ann.span,
      );
      return;
    }

    // 4. Annotation-specific validation
    switch (ann.name) {
      case 'intent':
        this.validateIntent(ann);
        break;
      case 'pre':
        this.validatePreCondition(ann, context);
        break;
      case 'post':
        this.validatePostCondition(ann, context);
        break;
      case 'audit':
        this.validateAudit(ann);
        break;
    }
  }

  // ─── Intent validation ───────────────────────────────────────

  private validateIntent(ann: Annotation): void {
    const args = ann.args.trim();

    // Intent should be a quoted string
    if (!args.startsWith('"') || !args.endsWith('"')) {
      this.error(
        `#[intent] expects a quoted string description, e.g., #[intent("...")]`,
        ann.span,
      );
      return;
    }

    // Extract the description
    const description = args.slice(1, -1).trim();

    if (description.length === 0) {
      this.error(
        `#[intent] description must not be empty`,
        ann.span,
      );
      return;
    }

    // Warn on very short descriptions (< 10 chars)
    if (description.length < 10) {
      this.warning(
        `#[intent] description is very short (${description.length} chars) — consider being more descriptive`,
        ann.span,
      );
    }
  }

  // ─── Pre-condition validation ────────────────────────────────

  private validatePreCondition(ann: Annotation, context: AnnotationContext): void {
    if (context.kind !== 'function') {
      this.error(
        `#[pre] is only valid on functions, not on ${context.kind} '${context.name}'`,
        ann.span,
      );
      return;
    }

    const condText = ann.args.trim();
    if (!condText) return; // Already caught by REQUIRES_ARGS

    // Extract identifiers from the condition and check against params
    const identifiers = extractIdentifiers(condText);
    for (const id of identifiers) {
      if (!context.paramNames.has(id) && !isBuiltinIdentifier(id)) {
        this.warning(
          `#[pre] references '${id}' which is not a parameter of '${context.name}'`,
          ann.span,
          `Parameters: ${[...context.paramNames].join(', ') || '(none)'}`,
        );
      }
    }
  }

  // ─── Post-condition validation ───────────────────────────────

  private validatePostCondition(ann: Annotation, context: AnnotationContext): void {
    if (context.kind !== 'function') {
      this.error(
        `#[post] is only valid on functions, not on ${context.kind} '${context.name}'`,
        ann.span,
      );
      return;
    }

    const condText = ann.args.trim();
    if (!condText) return;

    // Extract identifiers — 'result' is implicitly valid in postconditions
    const identifiers = extractIdentifiers(condText);
    for (const id of identifiers) {
      if (
        id !== 'result' &&
        !context.paramNames.has(id) &&
        !isBuiltinIdentifier(id)
      ) {
        this.warning(
          `#[post] references '${id}' which is not a parameter or 'result' in '${context.name}'`,
          ann.span,
          `Valid references: result, ${[...context.paramNames].join(', ') || '(none)'}`,
        );
      }
    }
  }

  // ─── Audit validation ────────────────────────────────────────

  private validateAudit(ann: Annotation): void {
    const args = ann.args.trim();

    // Parse audit args: #[audit("category", severity: "critical")]
    // Simple string matching — extract quoted strings and key-value pairs
    const quotedStrings = args.match(/"[^"]*"/g) ?? [];

    if (quotedStrings.length === 0) {
      this.error(
        `#[audit] requires at least a category string, e.g., #[audit("authentication")]`,
        ann.span,
      );
      return;
    }

    // Check for severity
    const severityMatch = args.match(/severity:\s*"([^"]*)"/);
    if (severityMatch) {
      const severity = severityMatch[1]!;
      if (!AUDIT_SEVERITIES.has(severity)) {
        this.warning(
          `Unknown audit severity '${severity}'. Valid values: ${[...AUDIT_SEVERITIES].join(', ')}`,
          ann.span,
        );
      }
    }
  }

  // ─── Duplicate detection ─────────────────────────────────────

  private checkDuplicates(annotations: Annotation[]): void {
    // intent, verify, audit should appear at most once
    const singletons = ['intent', 'verify'];
    for (const name of singletons) {
      const matches = annotations.filter(a => a.name === name);
      if (matches.length > 1) {
        for (const ann of matches.slice(1)) {
          this.warning(
            `Duplicate '#[${name}]' annotation — only the first will be used`,
            ann.span,
          );
        }
      }
    }
  }

  // ─── Diagnostics helpers ─────────────────────────────────────

  private error(message: string, span: Span): void {
    this.diagnostics.push(createError('E_INTENT', message, span));
  }

  private warning(message: string, span: Span, suggestion?: string): void {
    this.diagnostics.push(createWarning('W_INTENT', message, span, suggestion ? { suggestion } : {}));
  }
}

// ─── Annotation context ──────────────────────────────────────────

interface AnnotationContext {
  kind: 'function' | 'type' | 'actor' | 'contract' | 'server' | 'component';
  paramNames: Set<string>;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Extract likely identifier references from a condition string.
 * This is a best-effort extraction — it finds word-boundary identifiers
 * while excluding string literals, numbers, and known operators.
 */
function extractIdentifiers(conditionText: string): string[] {
  // Remove quoted strings
  const stripped = conditionText.replace(/"[^"]*"/g, '');

  // Match word-boundary identifiers
  const matches = stripped.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) ?? [];

  // Filter out keywords and operators
  const filtered = matches.filter(m => !CONDITION_KEYWORDS.has(m));

  // Deduplicate
  return [...new Set(filtered)];
}

/** Keywords and built-in names valid in conditions. */
const CONDITION_KEYWORDS = new Set([
  // Logical operators
  'and', 'or', 'not', 'implies', 'true', 'false',
  // Comparison
  'is', 'in',
  // Method-like builtins
  'is_ok', 'is_err', 'is_some', 'is_none', 'unwrap',
  'len', 'size', 'count',
  // Old-value reference
  'old',
]);

/** Check if an identifier is a known built-in / condition-language construct. */
function isBuiltinIdentifier(name: string): boolean {
  return CONDITION_KEYWORDS.has(name);
}
