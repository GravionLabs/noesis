import { DurationPipe } from './duration.pipe';

describe('DurationPipe', () => {
  const pipe = new DurationPipe();

  it('transforms null to em dash', () => {
    expect(pipe.transform(null)).toBe('\u2014');
  });

  it('transforms undefined to em dash', () => {
    expect(pipe.transform(undefined)).toBe('\u2014');
  });

  it('transforms < 1000ms to "< 1s"', () => {
    expect(pipe.transform(500)).toBe('< 1s');
    expect(pipe.transform(0)).toBe('< 1s');
    expect(pipe.transform(999)).toBe('< 1s');
  });

  it('transforms 1000-59999ms to seconds', () => {
    expect(pipe.transform(1000)).toBe('1s');
    expect(pipe.transform(5000)).toBe('5s');
    expect(pipe.transform(59000)).toBe('59s');
  });

  it('transforms 60000-3599999ms to minutes and seconds', () => {
    expect(pipe.transform(60000)).toBe('1m');
    expect(pipe.transform(120000)).toBe('2m');
    expect(pipe.transform(154000)).toBe('2m 34s');
  });

  it('transforms >= 3600000ms to hours and minutes', () => {
    expect(pipe.transform(3600000)).toBe('1h');
    expect(pipe.transform(3720000)).toBe('1h 2m');
    expect(pipe.transform(7200000)).toBe('2h');
  });
});
