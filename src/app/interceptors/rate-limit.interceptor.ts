import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';

/**
 * The maximum delay requested by the server for which a rate limited request
 * is automatically retried. Longer delays (like the usual 1 minute window)
 * are not retried, as the app would look frozen while waiting: users are
 * rather told to wait and try again.
 */
const MAX_RETRY_DELAY = 5000;

/**
 * How long the rate limit message is displayed (ms).
 */
const MESSAGE_DURATION = 10000;

// the currently displayed rate limit message, if any
let messageRef: MatSnackBarRef<unknown> | undefined;

function isRateLimitError(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 429;
}

/**
 * Get the delay in milliseconds requested by the Retry-After header of the
 * specified response, which can be either a number of seconds or an HTTP date.
 * Returns undefined when the header is missing or invalid.
 */
function getRetryDelay(error: HttpErrorResponse): number | undefined {
  const retryAfter = error.headers.get('Retry-After')?.trim();
  if (!retryAfter) {
    return undefined;
  }
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds) * 1000;
  }
  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/**
 * Get the message to show to users when the API rejects a request because
 * of its rate limit.
 */
export function getRateLimitMessage(error: HttpErrorResponse): string {
  const delay = getRetryDelay(error);
  if (delay === undefined || delay <= 0) {
    return $localize`:@@rateLimit.message:Too many requests to the server in a short time. Please wait a little and try again.`;
  }
  const seconds = Math.ceil(delay / 1000);
  return $localize`:@@rateLimit.messageWithDelay:Too many requests to the server in a short time. Please wait ${seconds}:seconds: seconds and try again.`;
}

function notify(snackBar: MatSnackBar, error: HttpErrorResponse): void {
  // open the message after the consumer has handled the error, so that
  // it is not replaced by any message opened by the consumer itself
  // (e.g. "Error exporting results")
  setTimeout(() => {
    // several concurrent requests can be rejected: just show one message
    if (messageRef) {
      return;
    }
    const ref = snackBar.open(
      getRateLimitMessage(error),
      $localize`:@@rateLimit.close:Close`,
      { duration: MESSAGE_DURATION },
    );
    messageRef = ref;
    ref.afterDismissed().subscribe(() => {
      if (messageRef === ref) {
        messageRef = undefined;
      }
    });
  });
}

/**
 * HTTP interceptor handling the API rate limit (429 Too Many Requests).
 * Requests are retried only when the server asks to wait for a short time;
 * otherwise users get a message telling them to wait, so that they do not
 * take the failure for a bug. The original error is then passed to the
 * consumer.
 */
export const rateLimitInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const snackBar = inject(MatSnackBar);

  return next(request).pipe(
    retry({
      count: 3,
      delay: (error) => {
        // retry only when the server tells when it will accept requests
        // again, and this is soon: retrying blindly inside the same rate
        // limit window would just add more rejected requests
        const delayTime = isRateLimitError(error)
          ? getRetryDelay(error)
          : undefined;
        return delayTime === undefined || delayTime > MAX_RETRY_DELAY
          ? throwError(() => error)
          : timer(delayTime);
      },
    }),
    catchError((error: unknown) => {
      if (isRateLimitError(error)) {
        notify(snackBar, error);
      }
      // pass the error untouched, as consumers rely on the original
      // HttpErrorResponse (e.g. its status)
      return throwError(() => error);
    }),
  );
};
