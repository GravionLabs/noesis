import { DateTimePipe } from './datetime.pipe';

describe('DateTimePipe', () => {
  const pipe = new DateTimePipe();

  it('transforms null to em dash', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('transforms undefined to em dash', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('transforms an invalid date string to em dash', () => {
    expect(pipe.transform('not-a-date')).toBe('—');
  });

  it('formats a date as DD.MM.YYYY HH:mm:ss.SSS', () => {
    const date = new Date(2026, 0, 31, 10, 0, 0, 367);
    expect(pipe.transform(date.toISOString())).toBe('31.01.2026 10:00:00.367');
  });

  it('pads single-digit day, month, time, and millisecond components', () => {
    const date = new Date(2026, 2, 5, 1, 2, 3, 4);
    expect(pipe.transform(date.toISOString())).toBe('05.03.2026 01:02:03.004');
  });
});
