import { computeScrollbarGeometry } from '../components/ThemedScrollbar';
import { Colors } from '../constants/theme';

describe('computeScrollbarGeometry', () => {
  it('hides the scrollbar when the content fits', () => {
    expect(computeScrollbarGeometry(300, 380, 364).visible).toBe(false);
    expect(computeScrollbarGeometry(380, 380, 364).visible).toBe(false);
  });

  it('hides the scrollbar before the list has been measured', () => {
    expect(computeScrollbarGeometry(0, 0, 0).visible).toBe(false);
    expect(computeScrollbarGeometry(2000, 0, 364).visible).toBe(false);
    expect(computeScrollbarGeometry(NaN, 380, 364).visible).toBe(false);
  });

  it('sizes the thumb to the visible share of the content', () => {
    // A quarter of the content is visible, so the thumb is a quarter of the track.
    const g = computeScrollbarGeometry(1600, 400, 400);
    expect(g.visible).toBe(true);
    expect(g.thumbHeight).toBeCloseTo(100, 5);
    expect(g.travel).toBeCloseTo(300, 5);
    expect(g.maxOffset).toBe(1200);
  });

  it('never lets the thumb shrink below the minimum, however long the list is', () => {
    const g = computeScrollbarGeometry(1_000_000, 380, 364);
    expect(g.thumbHeight).toBe(28);
    expect(g.travel).toBe(364 - 28);
  });

  it('keeps the thumb inside the track', () => {
    const g = computeScrollbarGeometry(381.5, 380, 364);
    expect(g.thumbHeight).toBeLessThanOrEqual(364);
    expect(g.travel).toBeGreaterThanOrEqual(0);
  });
});

describe('scrollbar colours match the website', () => {
  it('uses the gold thumb in both themes and a lighter track in light mode', () => {
    // frontend/css/tables/ledger.css
    expect(Colors.dark.scrollThumb).toBe('rgba(199, 154, 62, 0.45)');
    expect(Colors.light.scrollThumb).toBe('rgba(199, 154, 62, 0.45)');
    expect(Colors.dark.scrollTrack).toBe('rgba(0, 0, 0, 0.2)');
    expect(Colors.light.scrollTrack).toBe('rgba(0, 0, 0, 0.05)');
  });
});
