import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'duration', standalone: true })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    if (ms == null) {
      return '\u2014';
    }

    if (ms < 1000) {
      return '< 1s';
    }

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours >= 1) {
      const parts: string[] = [];
      parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      return parts.join(' ');
    }

    if (minutes >= 1) {
      const parts: string[] = [];
      parts.push(`${minutes}m`);
      if (seconds > 0) parts.push(`${seconds}s`);
      return parts.join(' ');
    }

    return `${seconds}s`;
  }
}
