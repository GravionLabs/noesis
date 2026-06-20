import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SettingsService } from '../services/settings.service';

export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const settings = inject(SettingsService);

  if (!settings.hasApiKey()) {
    return next(req);
  }

  const base = settings.baseUrl().replace(/\/+$/, '');
  const apiPrefix = base ? `${base}/api/` : '/api/';

  if (!req.url.startsWith(apiPrefix)) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: { 'X-Api-Key': settings.apiKey() },
  }));
};
