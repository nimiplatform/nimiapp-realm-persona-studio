#!/usr/bin/env tsx
/**
 * Spec consistency check for Realm Persona Studio.
 *
 * Per `.nimi/spec/INDEX.md`, the active authority surface is the kernel doc set under
 * `.nimi/spec/project/kernel/`. This check verifies the required canonical kernel files
 * exist, the rule catalog enumerates every inline R-RPS-* identifier used across the
 * kernel docs, and obvious scope-violation phrases never leak into implementation code.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SPEC_ROOT = path.join(REPO_ROOT, '.nimi', 'spec');
const KERNEL_DIR = path.join(SPEC_ROOT, 'project', 'kernel');
const RULE_CATALOG_PATH = path.join(KERNEL_DIR, 'tables', 'rule-catalog.yaml');
const SRC_DIR = path.join(REPO_ROOT, 'src');

const REQUIRED_TOP_LEVEL_FILES = [
  '.nimi/spec/INDEX.md',
  '.nimi/spec/project/AGENTS.md',
] as const;

const REQUIRED_KERNEL_FILES = [
  'index.md',
  'core-rules.md',
  'product-scope.md',
  'realm-persona-object.md',
  'persona-creation-graph.md',
  'persona-setting-field-map.md',
  'asset-and-binding.md',
  'post-publishing.md',
  'runtime-ai-consumption.md',
  'metrics-and-realm-gaps.md',
  'failure-semantics.md',
  'storybook.md',
  'product-acceptance-and-execution-plan.md',
] as const;

const REQUIRED_KERNEL_TABLES = [
  'tables/rule-catalog.yaml',
] as const;

const FORBIDDEN_PHRASES: Array<{ phrase: string; rationale: string }> = [
  {
    phrase: '/api/creator/agents',
    rationale: 'Evidence-only surface; must not be promoted into Studio canonical surfaces (per kernel core-rules and metrics-and-realm-gaps).',
  },
  {
    phrase: '/api/agent/dev/my-agents',
    rationale: 'Evidence-only surface; must not be promoted into Studio canonical surfaces (per kernel core-rules and metrics-and-realm-gaps).',
  },
  {
    phrase: '/api/agent/forge-imported-system',
    rationale: 'Forge/system curation is outside Realm Persona Studio implementation scope.',
  },
  {
    phrase: '/api/me/creator/worlds',
    rationale: 'Creator-world maintenance belongs to Realm World Studio, not the owner Persona Studio.',
  },
  {
    phrase: 'listMyCreatorWorlds',
    rationale: 'Creator-world list authority belongs to Realm World Studio, not the owner Persona Studio.',
  },
  {
    phrase: 'listCreatorWorldCharacters',
    rationale: 'Creator world-character list authority belongs to Realm World Studio, not the owner Persona Studio.',
  },
  {
    phrase: 'getCreatorWorldCharacter',
    rationale: 'Creator world-character detail authority belongs to Realm World Studio, not the owner Persona Studio.',
  },
  {
    phrase: 'listRealmPersonaStudioPortfolioPersonas',
    rationale: 'Do not reintroduce app-local portfolio aggregation aliases; owner portfolio reads must name the owner surface directly.',
  },
  {
    phrase: ['getRealmPersonaStudioPortfolio', 'Ag', 'ent', 'Detail'].join(''),
    rationale: 'Do not reintroduce app-local detail aggregation aliases; owner detail reads must name the owner surface directly.',
  },
  {
    phrase: 'agentFriendCount',
    rationale: 'First-version owner-visible metric is top-level `friendCount`; do not invent `agentFriendCount` (per kernel metrics-and-realm-gaps).',
  },
];

const RULE_ID_RE = /R-RPS-[A-Z]+-\d+/g;

type Finding = { file: string; line: number; column: number; message: string };

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function checkRequiredFiles(): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const relative of REQUIRED_TOP_LEVEL_FILES) {
    const absolute = path.join(REPO_ROOT, relative);
    if (!(await exists(absolute))) {
      findings.push({
        file: relative,
        line: 0,
        column: 0,
        message: `Required spec file missing.`,
      });
    }
  }
  for (const relative of REQUIRED_KERNEL_FILES) {
    const absolute = path.join(KERNEL_DIR, relative);
    if (!(await exists(absolute))) {
      findings.push({
        file: path.relative(REPO_ROOT, absolute),
        line: 0,
        column: 0,
        message: `Required kernel doc missing.`,
      });
    }
  }
  for (const relative of REQUIRED_KERNEL_TABLES) {
    const absolute = path.join(KERNEL_DIR, relative);
    if (!(await exists(absolute))) {
      findings.push({
        file: path.relative(REPO_ROOT, absolute),
        line: 0,
        column: 0,
        message: `Required kernel table missing.`,
      });
    }
  }
  return findings;
}

async function checkRuleCatalogCoversInlineIds(): Promise<Finding[]> {
  const findings: Finding[] = [];
  if (!(await exists(RULE_CATALOG_PATH))) {
    return findings; // already reported as missing
  }
  const catalogText = await fs.readFile(RULE_CATALOG_PATH, 'utf8');
  const catalogIds = new Set<string>();
  for (const match of catalogText.matchAll(/^\s*-\s*(R-RPS-[A-Z]+-\d+)\s*$/gm)) {
    catalogIds.add(match[1]);
  }
  for (const relative of REQUIRED_KERNEL_FILES) {
    const absolute = path.join(KERNEL_DIR, relative);
    if (!(await exists(absolute))) continue;
    const text = await fs.readFile(absolute, 'utf8');
    const inline = new Set<string>();
    for (const m of text.matchAll(RULE_ID_RE)) {
      inline.add(m[0]);
    }
    for (const id of inline) {
      if (!catalogIds.has(id)) {
        findings.push({
          file: path.relative(REPO_ROOT, absolute),
          line: 0,
          column: 0,
          message: `Inline rule identifier ${id} is not enumerated in tables/rule-catalog.yaml. Either add it to the catalog or remove it from the kernel doc.`,
        });
      }
    }
  }
  return findings;
}

async function walkImplementationFiles(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '_archive') continue;
        await walk(absolute);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|rs|toml|json)$/.test(entry.name)) {
        out.push(absolute);
      }
    }
  }
  await walk(SRC_DIR);
  return out;
}

async function checkForbiddenPhrasesInImplementation(): Promise<Finding[]> {
  // Spec files name the forbidden phrases as evidence-only anti-targets by
  // design; we only flag if they leak into implementation/source code.
  const findings: Finding[] = [];
  const files = await walkImplementationFiles();
  for (const absolute of files) {
    const text = await fs.readFile(absolute, 'utf8');
    const lines = text.split('\n');
    for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
      const line = lines[lineNo] ?? '';
      // Skip comment lines that explicitly cite the phrase as forbidden /
      // evidence-only (e.g., a code comment naming the anti-target).
      if (/forbidden|evidence-only|do not promote|anti-target|must not|deprecated/i.test(line)) {
        continue;
      }
      for (const { phrase, rationale } of FORBIDDEN_PHRASES) {
        const column = line.indexOf(phrase);
        if (column >= 0) {
          findings.push({
            file: path.relative(REPO_ROOT, absolute),
            line: lineNo + 1,
            column: column + 1,
            message: `Forbidden phrase "${phrase}" in implementation: ${rationale}`,
          });
        }
      }
    }
  }
  return findings;
}

async function main(): Promise<void> {
  const findings = [
    ...(await checkRequiredFiles()),
    ...(await checkRuleCatalogCoversInlineIds()),
    ...(await checkForbiddenPhrasesInImplementation()),
  ];
  if (findings.length === 0) {
    console.log('Spec consistency: OK');
    return;
  }
  for (const f of findings) {
    if (f.line === 0) {
      console.error(`${f.file}: ${f.message}`);
    } else {
      console.error(`${f.file}:${f.line}:${f.column}  ${f.message}`);
    }
  }
  console.error(`\nSpec consistency: ${findings.length} finding(s)`);
  process.exit(1);
}

void main();
