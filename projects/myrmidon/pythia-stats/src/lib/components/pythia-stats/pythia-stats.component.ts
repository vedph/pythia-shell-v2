import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LocalStorageService } from '@myrmidon/ngx-tools';
import { StatsService } from '@myrmidon/pythia-api';

import { take } from 'rxjs/operators';

interface StatEntry {
  name: string;
  value: number;
}

@Component({
  selector: 'pythia-stats',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './pythia-stats.component.html',
  styleUrls: ['./pythia-stats.component.css'],
})
export class PythiaStatsComponent implements OnInit {
  public loading: boolean | undefined;
  public entries: StatEntry[];

  constructor(
    private _snackbar: MatSnackBar,
    private _statsService: StatsService,
    private _localStorage: LocalStorageService
  ) {
    this.entries = [];
  }

  ngOnInit(): void {
    this.refresh();
  }

  public refresh(): void {
    const entries: StatEntry[] | null = this._localStorage.retrieve<
      StatEntry[]
    >('pythia-stats', true);
    if (entries) {
      this.entries = entries;
      return;
    }

    this.loading = true;
    this._statsService
      .getStatistics()
      .pipe(take(1))
      .subscribe({
        next: (stats) => {
          this.loading = false;
          this.entries = Object.keys(stats)
            .sort()
            .map((k) => {
              return {
                name: k,
                value: stats[k],
              };
            });
          this._localStorage.store('pythia-stats', this.entries, true);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error getting stats');
          if (error) {
            console.error(JSON.stringify(error));
          }
          this._snackbar.open('Error getting stats', 'OK');
        },
      });
  }
}
