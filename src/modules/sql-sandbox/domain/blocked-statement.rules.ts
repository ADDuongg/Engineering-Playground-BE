export interface BlockedPatternRule {
  pattern: RegExp;
  message: string;
  hint: string;
}

export const BLOCKED_SQL_PATTERNS: BlockedPatternRule[] = [
  {
    pattern: /\bDROP\s+DATABASE\b/i,
    message: 'DROP DATABASE is not allowed in the playground sandbox.',
    hint: 'The playground uses a shared database that cannot be dropped during experiments.',
  },
  {
    pattern: /\bCOPY\b[\s\S]*\bPROGRAM\b/i,
    message: 'COPY TO/FROM PROGRAM is not allowed in the playground sandbox.',
    hint: 'File system access is blocked to keep experiments safe and isolated.',
  },
  {
    pattern: /\bCREATE\s+EXTENSION\b/i,
    message: 'Installing extensions is not allowed in the playground sandbox.',
    hint: 'Extension management is restricted to platform operators.',
  },
  {
    pattern: /\bGRANT\b|\bREVOKE\b/i,
    message: 'Role and permission changes are not allowed in the playground sandbox.',
    hint: 'Access control is managed by the platform, not during lab experiments.',
  },
  {
    pattern: /\bpg_read_file\b|\bpg_write_file\b|\blo_import\b|\blo_export\b/i,
    message: 'File system functions are not allowed in the playground sandbox.',
    hint: 'Experiments cannot access server files for security reasons.',
  },
];

export function findBlockedPattern(
  sql: string,
): BlockedPatternRule | undefined {
  const normalized = sql.trim();
  return BLOCKED_SQL_PATTERNS.find(({ pattern }) => pattern.test(normalized));
}
