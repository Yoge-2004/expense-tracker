import { parseReleaseNotes, FormattedReleaseNotes } from '../components/FormattedReleaseNotes';

describe('FormattedReleaseNotes and parseReleaseNotes', () => {
  it('exports a valid component', () => {
    expect(FormattedReleaseNotes).toBeDefined();
    expect(typeof FormattedReleaseNotes).toBe('object'); // React.memo component
  });

  it('parses empty or whitespace notes to empty array', () => {
    expect(parseReleaseNotes('')).toEqual([]);
    expect(parseReleaseNotes('   \n\n  ')).toEqual([]);
  });

  it('parses headings with smart icon mapping', () => {
    const markdown = [
      '## What\'s Changed',
      '## Bug Fixes',
      '### Performance Improvements',
      '## Documentation Updates',
      '## Miscellaneous',
    ].join('\n');

    const blocks = parseReleaseNotes(markdown);
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toMatchObject({
      type: 'heading',
      text: 'What\'s Changed',
      level: 2,
      icon: 'sparkles-outline',
    });
    expect(blocks[1]).toMatchObject({
      type: 'heading',
      text: 'Bug Fixes',
      level: 2,
      icon: 'shield-checkmark-outline',
    });
    expect(blocks[2]).toMatchObject({
      type: 'heading',
      text: 'Performance Improvements',
      level: 3,
      icon: 'flash-outline',
    });
    expect(blocks[3]).toMatchObject({
      type: 'heading',
      text: 'Documentation Updates',
      level: 2,
      icon: 'document-text-outline',
    });
    expect(blocks[4]).toMatchObject({
      type: 'heading',
      text: 'Miscellaneous',
      level: 2,
      icon: 'cube-outline',
    });
  });

  it('parses bullet points accurately', () => {
    const markdown = [
      '* Add dark mode syncing by @alice in #101',
      '- Fix splash screen color flashing by @bob in #102',
      '+ Improve test execution reliability',
    ].join('\n');

    const blocks = parseReleaseNotes(markdown);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      type: 'bullet',
      text: 'Add dark mode syncing by @alice in #101',
    });
    expect(blocks[1]).toMatchObject({
      type: 'bullet',
      text: 'Fix splash screen color flashing by @bob in #102',
    });
    expect(blocks[2]).toMatchObject({
      type: 'bullet',
      text: 'Improve test execution reliability',
    });
  });

  it('parses changelog compare links', () => {
    const markdown = [
      '**Full Changelog**: https://github.com/org/repo/compare/v1.0.11...v1.0.12',
    ].join('\n');

    const blocks = parseReleaseNotes(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: 'changelog-link',
      text: 'View Full Commit Changelog',
      url: 'https://github.com/org/repo/compare/v1.0.11...v1.0.12',
    });
  });
});
