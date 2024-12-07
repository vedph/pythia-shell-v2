import { Component, input, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SearchService } from '@myrmidon/pythia-api';

@Component({
  selector: 'pythia-search-export',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './search-export.component.html',
  styleUrl: './search-export.component.scss',
})
export class SearchExportComponent implements OnDestroy {
  private _sub?: Subscription;

  /**
   * The query to export results for.
   */
  public readonly query = input<string | null | undefined>();

  /**
   * Whether the export button is disabled.
   */
  public readonly disabled = input<boolean | undefined>();

  public isExporting = false;

  constructor(
    private _searchService: SearchService,
    private _snackbar: MatSnackBar
  ) {}

  public ngOnDestroy() {
    this.cancelExport();
  }

  private downloadCsv(csvData: string) {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'search_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public exportCsv() {
    if (!this.query() || this.isExporting) {
      return;
    }
    this.isExporting = true;

    this._sub = this._searchService
      .exportSearchResults(this.query()!)
      .subscribe({
        next: (csvData: string) => {
          this.downloadCsv(csvData);
          this.isExporting = false;
          this._snackbar.open('Results exported', 'OK', { duration: 2000 });
        },
        error: (error) => {
          console.error('Error exporting CSV:', error);
          this.isExporting = false;
          this._snackbar.open('Error exporting results', 'Error');
        },
        complete: () => {
          this.isExporting = false;
        },
      });
  }

  public cancelExport() {
    if (this._sub) {
      this._sub.unsubscribe();
      this._sub = undefined;
      this.isExporting = false;
    }
  }
}
