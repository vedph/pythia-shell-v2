import { PercentagePipe } from './percentage.pipe';

describe('PercentagePipe', () => {
  const pipe = new PercentagePipe();

  it('should return 0% for zero or missing total', () => {
    expect(pipe.transform(5, 0)).toBe('0%');
    expect(pipe.transform(5, undefined as unknown as number)).toBe('0%');
  });

  it('should format with 2 fraction digits by default', () => {
    expect(pipe.transform(1, 3)).toBe('33.33%');
    expect(pipe.transform(3, 3)).toBe('100.00%');
  });

  it('should format with the specified fraction digits', () => {
    expect(pipe.transform(1, 3, 1)).toBe('33.3%');
    expect(pipe.transform(1, 3, 0)).toBe('33%');
  });
});
