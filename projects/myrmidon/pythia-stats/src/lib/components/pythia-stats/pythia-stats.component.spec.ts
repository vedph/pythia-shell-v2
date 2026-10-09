import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { LocalStorageService } from '@myrmidon/ngx-tools';
import { StatsService } from '@myrmidon/pythia-api';

import { PythiaStatsComponent } from './pythia-stats.component';

async function setup(cached: { name: string; value: number }[] | null = null) {
  const statsService = {
    getStatistics: vi
      .fn()
      .mockReturnValue(of({ word_count: 12345, document_count: 3 })),
  };
  const storage = {
    retrieve: vi.fn().mockReturnValue(cached),
    store: vi.fn(),
  };
  const snackbar = { open: vi.fn() };
  const result = await render(PythiaStatsComponent, {
    providers: [
      { provide: StatsService, useValue: statsService },
      { provide: LocalStorageService, useValue: storage },
      { provide: MatSnackBar, useValue: snackbar },
    ],
  });
  return { ...result, statsService, storage, snackbar, user: userEvent.setup() };
}

const rowTexts = () =>
  screen
    .getAllByRole('row')
    .map((r) =>
      within(r)
        .getAllByRole('cell')
        .map((c) => c.textContent?.trim()),
    );

describe('PythiaStatsComponent', () => {
  it('should load sorted stats from server and cache them', async () => {
    const { statsService, storage } = await setup();
    expect(statsService.getStatistics).toHaveBeenCalledTimes(1);
    expect(rowTexts()).toEqual([
      ['document_count', '3'],
      ['word_count', '12,345'],
    ]);
    expect(storage.store).toHaveBeenCalledWith(
      'pythia-stats',
      [
        { name: 'document_count', value: 3 },
        { name: 'word_count', value: 12345 },
      ],
      true,
    );
  });

  it('should use cached stats', async () => {
    const { statsService } = await setup([{ name: 'cached', value: 1 }]);
    expect(statsService.getStatistics).not.toHaveBeenCalled();
    expect(rowTexts()).toEqual([['cached', '1']]);
  });

  it('should reload stats from server on refresh', async () => {
    const { user, statsService } = await setup([{ name: 'cached', value: 1 }]);
    await user.click(screen.getByRole('button', { name: /refresh/ }));
    expect(statsService.getStatistics).toHaveBeenCalledTimes(1);
    expect(rowTexts()).toEqual([
      ['document_count', '3'],
      ['word_count', '12,345'],
    ]);
  });

  it('should notify errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const statsService = {
      getStatistics: vi.fn().mockReturnValue(throwError(() => 'boom')),
    };
    const snackbar = { open: vi.fn() };
    await render(PythiaStatsComponent, {
      providers: [
        { provide: StatsService, useValue: statsService },
        {
          provide: LocalStorageService,
          useValue: { retrieve: () => null, store: vi.fn() },
        },
        { provide: MatSnackBar, useValue: snackbar },
      ],
    });
    expect(snackbar.open).toHaveBeenCalledWith('Error getting stats', 'OK');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
