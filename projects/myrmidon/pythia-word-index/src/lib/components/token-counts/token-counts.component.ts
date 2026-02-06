import { CommonModule } from '@angular/common';
import { Component, effect, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

// https://github.com/xieziyu/ngx-echarts
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
// import * as echarts from 'echarts/core';
import { echarts } from './custom-echarts';
import { EChartsOption } from 'echarts';
import { AttributeInfo, TokenCount } from '@myrmidon/pythia-api';

import { PercentagePipe } from '../../pipes/percentage.pipe';

/**
 * A component to display the counts for a specific token in a pie chart.
 */
@Component({
  selector: 'pythia-token-counts',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBar,
    MatSelectModule,
    MatTooltipModule,
    PercentagePipe,
    NgxEchartsDirective,
  ],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './token-counts.component.html',
  styleUrl: './token-counts.component.scss',
})
export class TokenCountsComponent {
  /**
   * The attribute for which the counts are displayed.
   */
  public readonly attribute = input<AttributeInfo | undefined>();

  /**
   * The counts for the attribute.
   */
  public readonly counts = input<TokenCount[]>([]);

  /**
   * Whether to hide the toolbar.
   */
  public readonly hideToolbar = input<boolean | undefined>();

  public readonly chartOptions = signal<EChartsOption | null>(null);
  public readonly total = signal(0);
  public readonly downloading = signal<boolean>(false);

  constructor(
    private _clipboard: Clipboard,
    private _snackbar: MatSnackBar,
  ) {
    effect(() => {
      const counts = this.counts();
      if (counts && counts.length > 0) {
        console.log('input counts', counts);
        this.updateChart(counts);
      } else {
        // reset chart when no counts
        this.chartOptions.set(null);
        this.total.set(0);
      }
    });
  }

  private updateChart(counts: TokenCount[]): void {
    // calculate total count
    const totalCount = counts.reduce((acc, c) => acc + c.value, 0);
    this.total.set(totalCount);

    // create pie chart from counts only if we have data
    if (totalCount > 0) {
      // https://www.npmjs.com/package/ngx-echarts
      this.chartOptions.set({
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)',
        },
        legend: {
          orient: 'vertical',
          left: 10,
          data: counts.map((c) => c.attributeValue),
        },
        series: [
          {
            name: 'count',
            type: 'pie',
            radius: '50%',
            center: ['50%', '60%'],
            data: counts.map((c) => ({
              name: c.attributeValue,
              value: c.value,
            })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      });
    }
  }

  private getCSV(): string {
    // get a CSV representation of the counts
    let csv = 'attr_name,attr_value,nr,percent\n';
    for (const count of this.counts()) {
      csv += `${this.attribute?.name},${count.attributeValue},${count.value},${
        count.value / this.total()
      }\n`;
    }
    return csv;
  }

  public copy(): void {
    if (!this.counts().length) {
      return;
    }

    const csv = this.getCSV();
    this._clipboard.copy(csv);
    this._snackbar.open($localize`Copied to clipboard`, undefined, {
      duration: 2000,
    });
  }

  public download(): void {
    if (this.downloading() || !this.counts().length) {
      return;
    }
    this.downloading.set(true);

    let csv = this.getCSV();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const element = document.createElement('a');
    const file = new Blob([csv], { type: 'text/csv' });
    element.href = URL.createObjectURL(file);
    element.download = `${year}${month}${day}_${hours}${minutes}${seconds}.csv`;

    document.body.appendChild(element);
    element.click();

    this.downloading.set(false);
  }
}
