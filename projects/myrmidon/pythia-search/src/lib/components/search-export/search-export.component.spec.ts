import { inputBinding, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { SearchService } from '@myrmidon/pythia-api';

import { SearchExportComponent } from './search-export.component';

async function setup(query: string | null = '[value="a"]', disabled = false) {
  const searchService = {
    exportSearchResults: vi.fn().mockReturnValue(of('a,b\n1,2')),
  };
  const snackbar = { open: vi.fn() };
  const result = await render(SearchExportComponent, {
    bindings: [
      inputBinding('query', signal(query)),
      inputBinding('disabled', signal(disabled)),
    ],
    providers: [
      { provide: SearchService, useValue: searchService },
      { provide: MatSnackBar, useValue: snackbar },
    ],
  });
  return { ...result, searchService, snackbar, user: userEvent.setup() };
}

const exportButton = () =>
  screen.getByRole('button', { name: /export/ }) as HTMLButtonElement;

describe('SearchExportComponent', () => {
  let createUrl: ReturnType<typeof vi.fn>;
  let revokeUrl: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createUrl = vi.fn().mockReturnValue('blob:x');
    revokeUrl = vi.fn();
    window.URL.createObjectURL = createUrl as never;
    window.URL.revokeObjectURL = revokeUrl as never;
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => clickSpy.mockRestore());

  it('should disable export when requested', async () => {
    await setup('q', true);
    expect(exportButton().disabled).toBe(true);
  });

  it('should export and download the CSV', async () => {
    const { user, searchService, snackbar } = await setup();
    await user.click(exportButton());
    expect(searchService.exportSearchResults).toHaveBeenCalledWith(
      '[value="a"]',
    );
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:x');
    expect(snackbar.open).toHaveBeenCalledWith('Results exported', 'OK', {
      duration: 2000,
    });
    expect(exportButton().disabled).toBe(false);
  });

  it('should not export without query', async () => {
    const { user, searchService } = await setup(null);
    await user.click(exportButton());
    expect(searchService.exportSearchResults).not.toHaveBeenCalled();
  });

  it('should notify export errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user, searchService, snackbar } = await setup();
    searchService.exportSearchResults.mockReturnValue(throwError(() => 'boom'));
    await user.click(exportButton());
    expect(snackbar.open).toHaveBeenCalledWith(
      'Error exporting results',
      'Error',
    );
    expect(exportButton().disabled).toBe(false);
  });

  it('should show progress and allow cancelling', async () => {
    const { user, searchService } = await setup();
    const pending = new Subject<string>();
    searchService.exportSearchResults.mockReturnValue(pending);
    await user.click(exportButton());
    expect(exportButton().disabled).toBe(true);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /cancel/ }));
    expect(pending.observed).toBe(false);
    expect(exportButton().disabled).toBe(false);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
