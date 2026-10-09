import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { CorpusFilter } from '@myrmidon/pythia-api';

import { CorpusFilterComponent } from './corpus-filter.component';

async function setup(initial?: CorpusFilter | null, disabled = false) {
  const filter = signal<CorpusFilter | null | undefined>(initial);
  const isDisabled = signal<boolean | undefined>(disabled);
  const filterChange = vi.fn();
  const result = await render(CorpusFilterComponent, {
    bindings: [
      inputBinding('filter', filter),
      inputBinding('disabled', isDisabled),
      outputBinding('filterChange', filterChange),
    ],
  });
  return {
    ...result,
    filter,
    isDisabled,
    filterChange,
    user: userEvent.setup(),
  };
}

const idBox = () =>
  screen.getByRole('textbox', { name: 'ID' }) as HTMLInputElement;
const titleBox = () =>
  screen.getByRole('textbox', { name: 'title' }) as HTMLInputElement;
const applyButton = () =>
  screen.getByRole('button', { name: 'Apply filters' }) as HTMLButtonElement;
const resetButton = () =>
  screen.getByRole('button', { name: 'Reset filters' }) as HTMLButtonElement;

describe('CorpusFilterComponent', () => {
  it('should render empty controls without filter', async () => {
    await setup();
    expect(idBox().value).toBe('');
    expect(titleBox().value).toBe('');
  });

  it('should load the filter into the controls', async () => {
    await setup({ id: 'zeus_', title: 'myth' });
    expect(idBox().value).toBe('zeus_');
    expect(titleBox().value).toBe('myth');
  });

  it('should update controls when filter changes', async () => {
    const { filter, fixture } = await setup({ id: 'a' });
    filter.set({ title: 'b' });
    await fixture.whenStable();
    expect(idBox().value).toBe('');
    expect(titleBox().value).toBe('b');
    filter.set(null);
    await fixture.whenStable();
    expect(titleBox().value).toBe('');
  });

  it('should enable the buttons when not disabled', async () => {
    await setup();
    expect(applyButton().disabled).toBe(false);
    expect(resetButton().disabled).toBe(false);
  });

  it('should disable the buttons when disabled', async () => {
    const { isDisabled, fixture } = await setup(undefined, true);
    expect(applyButton().disabled).toBe(true);
    expect(resetButton().disabled).toBe(true);
    isDisabled.set(false);
    await fixture.whenStable();
    expect(applyButton().disabled).toBe(false);
  });

  it('should apply trimmed filter on click', async () => {
    const { user, filterChange } = await setup();
    await user.type(idBox(), ' zeus ');
    await user.type(titleBox(), ' myths ');
    await user.click(applyButton());
    expect(filterChange).toHaveBeenCalledWith({ id: 'zeus', title: 'myths' });
  });

  it('should apply filter on Enter', async () => {
    const { user, filterChange } = await setup();
    await user.type(titleBox(), 'x{Enter}');
    expect(filterChange).toHaveBeenCalledWith({ id: undefined, title: 'x' });
  });

  it('should not apply filter on Enter when disabled', async () => {
    const { user, filterChange } = await setup(undefined, true);
    await user.type(titleBox(), 'x{Enter}');
    expect(filterChange).not.toHaveBeenCalled();
  });

  it('should omit fields cleared by the user', async () => {
    const { user, filterChange } = await setup({ id: 'a', title: 'b' });
    await user.clear(idBox());
    await user.click(applyButton());
    expect(filterChange).toHaveBeenCalledWith({ id: undefined, title: 'b' });
  });

  it('should render no <form> element', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('should reset controls and emit an empty filter', async () => {
    const { user, filterChange } = await setup({ id: 'a', title: 'b' });
    await user.click(resetButton());
    expect(idBox().value).toBe('');
    expect(titleBox().value).toBe('');
    expect(filterChange).toHaveBeenCalledWith({});
  });
});
