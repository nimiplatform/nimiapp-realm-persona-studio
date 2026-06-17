import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('persona insights admitted metrics boundary', () => {
  it('does not derive owner-visible freshness metrics locally', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/shell/renderer/features/persona-insights/persona-insights-page.tsx'),
      'utf8',
    );

    expect(source).toContain('friendCount');
    expect(source).not.toContain('Setting freshness');
    expect(source).not.toContain('Date.now');
    expect(source).not.toContain('STALE_DAY_THRESHOLD');
    expect(source).not.toContain('Run consistency review');
  });
});
