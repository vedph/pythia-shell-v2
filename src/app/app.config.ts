import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { provideNativeDateAdapter } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { EnvServiceProvider } from '@myrmidon/ngx-tools';
import { authJwtInterceptor } from '@myrmidon/auth-jwt-login';

import { QUERY_BUILDER_ATTR_DEFS_KEY } from '../../projects/myrmidon/pythia-query-builder/src/public-api';

import { routes } from './app.routes';
import { ATTR_DEFS } from './attr-defs';
import { I18nPaginatorIntlService } from './services/i18n-paginator-intl.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authJwtInterceptor])),
    provideNativeDateAdapter(),
    EnvServiceProvider,
    // query builder
    {
      provide: QUERY_BUILDER_ATTR_DEFS_KEY,
      useValue: ATTR_DEFS,
    },
    // paginator i18n
    {
      provide: MatPaginatorIntl,
      useClass: I18nPaginatorIntlService,
    },
  ],
};
