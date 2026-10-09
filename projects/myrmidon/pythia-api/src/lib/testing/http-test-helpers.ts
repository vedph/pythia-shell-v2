import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EnvService } from '@myrmidon/ngx-tools';

// Test-only helpers shared by the services specs (not exported by the
// library's public API).

export const API_URL = 'http://localhost/api/';

/**
 * Configure TestBed with a testing HTTP backend and an EnvService stub
 * returning API_URL for apiUrl.
 */
export function setupHttpTestBed(): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: EnvService,
        useValue: {
          get: (key: string, defValue?: string) =>
            key === 'apiUrl' ? API_URL : defValue,
        },
      },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

/**
 * Fail with a server error all the requests matching the specified URL,
 * for as many times as specified (1 + the number of retries).
 */
export function failRequests(
  http: HttpTestingController,
  url: string,
  times: number,
): void {
  for (let i = 0; i < times; i++) {
    http
      .expectOne((r) => r.url === url)
      .flush('boom', { status: 500, statusText: 'Server Error' });
  }
}

/**
 * Expect a single request with the specified URL and method, and return it.
 */
export function expectUrl(
  http: HttpTestingController,
  url: string,
  method = 'GET',
): TestRequest {
  const req = http.expectOne((r) => r.url === url);
  expect(req.request.method).toBe(method);
  return req;
}

/**
 * An empty data page.
 */
export function emptyPage(pageNumber = 1, pageSize = 20) {
  return { items: [], pageNumber, pageSize, pageCount: 0, total: 0 };
}
