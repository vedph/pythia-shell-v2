import { CommonModule } from '@angular/common';
import { Directive, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PercentagePipe } from '../pipes/percentage.pipe';
import { TokenCountsComponent } from '../components/token-counts/token-counts.component';

// Test-only helpers (not exported by the library's public API).

/**
 * Stub for the echarts directive, as jsdom has no canvas.
 */
@Directive({ selector: '[echarts]' })
export class EchartsStubDirective {
  public readonly options = input<unknown>();
}

/**
 * The imports of TokenCountsComponent with echarts replaced by a stub.
 */
export const TOKEN_COUNTS_TEST_IMPORTS = [
  CommonModule,
  MatButtonModule,
  MatExpansionModule,
  MatIconModule,
  MatProgressBar,
  MatTooltipModule,
  PercentagePipe,
  EchartsStubDirective,
];

/**
 * Replace echarts with a stub in TokenCountsComponent, when it is rendered
 * as a descendant of the tested component.
 */
export function stubTokenCountsCharts(testBed: TestBed): void {
  testBed.overrideComponent(TokenCountsComponent, {
    set: { imports: TOKEN_COUNTS_TEST_IMPORTS },
  });
}
