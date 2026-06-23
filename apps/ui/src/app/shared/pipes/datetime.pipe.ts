import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'datetime', standalone: true })
export class DateTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    const pad = (n: number, width = 2) => String(n).padStart(width, '0');

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const millis = pad(date.getMilliseconds(), 3);

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}.${millis}`;
  }
}
