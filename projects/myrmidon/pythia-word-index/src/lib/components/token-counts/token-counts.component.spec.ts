import { Directive, input, inputBinding, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AttributeInfo, TokenCount } from '@myrmidon/pythia-api';

import { PercentagePipe } from '../../pipes/percentage.pipe';
import { TokenCountsComponent } from './token-counts.component';

/**
 * Stub for the echarts directive, as jsdom has no canvas.
 */
@Directive({ selector: '[echarts]' })
class EchartsStubDirective {
  public readonly options = input<unknown>();
}

const ATTR: AttributeInfo = { name: 'genre', type: 0 };
const COUNTS: TokenCount[] = [
  { sourceId: 1, attributeName: 'genre', attributeValue: 'epic', value: 3 },
  { sourceId: 1, attributeName: 'genre', attributeValue: 'lyric, elegiac', value: 1 },
];

async function setup(counts: TokenCount[] = COUNTS, hideToolbar = false) {
  const clipboard = { copy: vi.fn() };
  const snackbar = { open: vi.fn() };
  const countsSignal = signal<TokenCount[]>(counts);
  const result = await render(TokenCountsComponent, {
    componentImports: [
      CommonModule,
      MatButtonModule,
      MatExpansionModule,
      MatIconModule,
      MatProgressBar,
      MatTooltipModule,
      PercentagePipe,
      EchartsStubDirective,
    ],
    bindings: [
      inputBinding('counts', countsSignal),
      inputBinding('attribute', signal(ATTR)),
      inputBinding('hideToolbar', signal(hideToolbar)),
    ],
    providers: [
      { provide: Clipboard, useValue: clipboard },
      { provide: MatSnackBar, useValue: snackbar },
    ],
  });
  return {
    ...result,
    countsSignal,
    clipboard,
    snackbar,
    user: userEvent.setup(),
  };
}

const EXPECTED_CSV =
  'attr_name,attr_value,nr,percent\n' +
  'genre,epic,3,0.75\n' +
  'genre,"lyric, elegiac",1,0.25\n';

describe('TokenCountsComponent', () => {
  it('should show the total and the counts table', async () => {
    const { user } = await setup();
    // the table is in a collapsed panel, whose header shows the total
    await user.click(screen.getByRole('button', { name: '4' }));
    const rows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent?.trim()),
      ),
    ).toEqual([
      ['epic', '3', '75.00%'],
      ['lyric, elegiac', '1', '25.00%'],
    ]);
  });

  it('should reset total without counts', async () => {
    const { countsSignal, fixture } = await setup();
    countsSignal.set([]);
    await fixture.whenStable();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('should copy CSV with attribute name and escaped values', async () => {
    const { user, clipboard, snackbar } = await setup();
    await user.click(screen.getByRole('button', { name: 'Copy data' }));
    expect(clipboard.copy).toHaveBeenCalledWith(EXPECTED_CSV);
    expect(snackbar.open).toHaveBeenCalledWith(
      'Copied to clipboard',
      undefined,
      { duration: 2000 },
    );
  });

  it('should not copy without counts', async () => {
    const { user, clipboard } = await setup([]);
    await user.click(screen.getByRole('button', { name: 'Copy data' }));
    expect(clipboard.copy).not.toHaveBeenCalled();
  });

  it('should download CSV and clean up', async () => {
    const createUrl = vi.fn().mockReturnValue('blob:x');
    const revokeUrl = vi.fn();
    URL.createObjectURL = createUrl as never;
    URL.revokeObjectURL = revokeUrl as never;
    let clicked: HTMLAnchorElement | undefined;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked = this;
      });
    try {
      const { user } = await setup();
      await user.click(screen.getByRole('button', { name: 'Download data' }));
      const blob = createUrl.mock.calls[0][0] as Blob;
      expect(await blob.text()).toBe(EXPECTED_CSV);
      expect(clicked?.download).toMatch(/^\d{8}_\d{6}\.csv$/);
      expect(clicked?.isConnected).toBe(false);
      expect(revokeUrl).toHaveBeenCalled();
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('should hide the toolbar', async () => {
    await setup(COUNTS, true);
    expect(screen.queryByRole('button', { name: 'Copy data' })).toBeNull();
  });
});
