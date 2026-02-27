/**
 * Regex-based Code Parser
 *
 * Extracts functions, classes, interfaces, type aliases, and imports
 * from TS/JS/Python source files using regular expressions.
 * No tree-sitter dependency — lightweight MVP approach.
 */

export interface ParseResult {
  symbols: Array<{
    name: string;
    type: 'function' | 'class' | 'interface' | 'type' | 'variable';
    lineStart: number;
    extends?: string;
  }>;
  imports: Array<{
    names: string[];
    source: string;
    lineNumber: number;
  }>;
}

/**
 * Parse a source file and extract symbols + imports.
 */
export function parseFile(content: string, filePath: string): ParseResult {
  const ext = filePath.split('.').pop()?.toLowerCase();

  if (['ts', 'tsx', 'js', 'jsx', 'mjs'].includes(ext || '')) {
    return parseTypeScript(content);
  }
  if (ext === 'py') {
    return parsePython(content);
  }

  return { symbols: [], imports: [] };
}

// ── TypeScript / JavaScript ──────────────────────────────────────────────

function parseTypeScript(content: string): ParseResult {
  const symbols: ParseResult['symbols'] = [];
  const imports: ParseResult['imports'] = [];

  let match: RegExpExecArray | null;

  // Named functions: export? async? function name(
  const fnRe = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  while ((match = fnRe.exec(content)) !== null) {
    symbols.push({
      name: match[1],
      type: 'function',
      lineStart: lineAt(content, match.index),
    });
  }

  // Arrow / const functions: export? const name = async? (
  const arrowRe = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/g;
  while ((match = arrowRe.exec(content)) !== null) {
    symbols.push({
      name: match[1],
      type: 'function',
      lineStart: lineAt(content, match.index),
    });
  }

  // Classes: export? class Name extends? Base
  const classRe = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
  while ((match = classRe.exec(content)) !== null) {
    symbols.push({
      name: match[1],
      type: 'class',
      lineStart: lineAt(content, match.index),
      extends: match[2] || undefined,
    });
  }

  // Interfaces: export? interface Name extends? Base
  const ifaceRe = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+(\w+))?/g;
  while ((match = ifaceRe.exec(content)) !== null) {
    symbols.push({
      name: match[1],
      type: 'interface',
      lineStart: lineAt(content, match.index),
      extends: match[2] || undefined,
    });
  }

  // Type aliases: export? type Name =
  const typeRe = /(?:export\s+)?type\s+(\w+)\s*=/g;
  while ((match = typeRe.exec(content)) !== null) {
    symbols.push({
      name: match[1],
      type: 'type',
      lineStart: lineAt(content, match.index),
    });
  }

  // Imports: import { a, b } from 'path'  OR  import X from 'path'
  const importRe = /import\s+(?:(?:\{([^}]*)\})|(\w+))(?:\s*,\s*(?:\{([^}]*)\}|(\w+)))?\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = importRe.exec(content)) !== null) {
    const names: string[] = [];
    // Named imports from first group
    if (match[1]) {
      names.push(...match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean));
    }
    // Default import
    if (match[2]) names.push(match[2]);
    // Second set of named imports (import X, { a, b })
    if (match[3]) {
      names.push(...match[3].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean));
    }
    if (match[4]) names.push(match[4]);

    imports.push({
      names,
      source: match[5],
      lineNumber: lineAt(content, match.index),
    });
  }

  return { symbols, imports };
}

// ── Python ───────────────────────────────────────────────────────────────

function parsePython(content: string): ParseResult {
  const symbols: ParseResult['symbols'] = [];
  const imports: ParseResult['imports'] = [];

  let match: RegExpExecArray | null;

  // def function_name(
  const fnRe = /^(?:async\s+)?def\s+(\w+)\s*\(/gm;
  while ((match = fnRe.exec(content)) !== null) {
    symbols.push({
      name: match[1],
      type: 'function',
      lineStart: lineAt(content, match.index),
    });
  }

  // class ClassName(Base):
  const classRe = /^class\s+(\w+)(?:\(([^)]*)\))?/gm;
  while ((match = classRe.exec(content)) !== null) {
    symbols.push({
      name: match[1],
      type: 'class',
      lineStart: lineAt(content, match.index),
      extends: match[2]?.split(',')[0]?.trim() || undefined,
    });
  }

  // from module import name  OR  import module
  const importRe = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
  while ((match = importRe.exec(content)) !== null) {
    const source = match[1] || match[2].split(',')[0].trim().split(/\s+as\s+/)[0].trim();
    const names = match[2].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    imports.push({
      names,
      source,
      lineNumber: lineAt(content, match.index),
    });
  }

  return { symbols, imports };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function lineAt(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}
