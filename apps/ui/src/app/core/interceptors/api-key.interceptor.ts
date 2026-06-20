import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SettingsService } from '../services/settings.service';

export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const settings = inject(SettingsService);

  if (!settings.hasApiKey()) {
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: { 'X-Api-Key': settings.apiKey() },
  });

  return next(cloned);
};
