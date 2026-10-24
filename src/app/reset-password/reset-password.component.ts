import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  FormField,
  FormRoot,
  email,
  form,
  required,
} from '@angular/forms/signals';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthJwtAccountService } from '@myrmidon/auth-jwt-admin';

@Component({
  selector: 'cadmus-reset-password',
  standalone: true,
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormField,
    FormRoot,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
})
export class ResetPasswordComponent {
  public readonly busy = signal<boolean>(false);

  /**
   * The form. This page is a real submission root: submitting it
   * runs reset() when the form is valid.
   */
  public readonly form = form(
    signal({ email: '' }),
    (p) => {
      required(p.email);
      email(p.email);
    },
    {
      submission: {
        action: async () => {
          this.reset();
          return undefined;
        },
      },
    },
  );

  constructor(
    private _snackbar: MatSnackBar,
    private _accountService: AuthJwtAccountService,
  ) {}

  public reset(): void {
    const address = this.form.email().value();
    if (this.busy() || !address) {
      return;
    }

    this.busy.set(true);
    this._accountService.resetPassword(address).subscribe({
      next: () => {
        this.busy.set(false);
        this._snackbar.open(`Message sent to ${address}`, 'OK');
      },
      error: (error) => {
        this.busy.set(false);
        console.error(error);
        this._snackbar.open(`Error sending message to ${address}`, 'OK');
      },
    });
  }
}
