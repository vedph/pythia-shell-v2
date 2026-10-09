
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';

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
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
  imports: [
    FormField,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule
],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  public readonly busy = signal(false);
  public readonly form = form(signal({ email: '' }), (path) => {
    required(path.email);
    email(path.email);
  });

  constructor(
    private _snackbar: MatSnackBar,
    private _accountService: AuthJwtAccountService
  ) {}

  public reset(): void {
    if (this.busy() || this.form().invalid()) {
      this.form().markAsTouched();
      return;
    }
    const address = this.form.email().value();

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
