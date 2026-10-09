import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {
  QueryBuilderTermDefArg,
  QUERY_LOCATION_OP_DEFS,
  QUERY_PAIR_OP_DEFS,
} from '../../query-builder';
import { QueryOpArgsComponent } from './query-op-args.component';

const NEAR_ARGS = QUERY_LOCATION_OP_DEFS.find((d) => d.value === 'NEAR')!
  .args!;
const FUZZY_ARGS = QUERY_PAIR_OP_DEFS.find((d) => d.value === '%=')!.args!;

async function setup(initial?: QueryBuilderTermDefArg[] | null) {
  const args = signal<QueryBuilderTermDefArg[] | null | undefined>(initial);
  const argsChange = vi.fn();
  const result = await render(QueryOpArgsComponent, {
    bindings: [
      inputBinding('args', args),
      outputBinding('argsChange', argsChange),
    ],
  });
  return { ...result, args, argsChange, user: userEvent.setup() };
}

const saveButton = () =>
  screen.getByRole('button', { name: 'Save arguments' }) as HTMLButtonElement;

describe('QueryOpArgsComponent', () => {
  it('should render nothing without args', async () => {
    await setup();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('should render a control for each arg', async () => {
    await setup(NEAR_ARGS);
    expect(screen.getByRole('group', { name: 'arguments' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'min.distance' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'max distance' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'in structure' })).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('should show existing values', async () => {
    await setup([{ ...NEAR_ARGS[0], value: '2' }, NEAR_ARGS[1]]);
    expect(
      (screen.getByRole('spinbutton', { name: 'min.distance' }) as HTMLInputElement)
        .value,
    ).toBe('2');
  });

  it('should use the arg ID when it has no label', async () => {
    await setup([{ id: 'x' }]);
    expect(screen.getByRole('textbox', { name: 'x' })).toBeTruthy();
  });

  it('should save only the args with a value', async () => {
    const { user, argsChange } = await setup(NEAR_ARGS);
    await user.type(screen.getByRole('spinbutton', { name: 'max distance' }), '3');
    await user.type(screen.getByRole('textbox', { name: 'in structure' }), 'snt');
    await user.click(saveButton());
    expect(argsChange).toHaveBeenCalledWith([
      { ...NEAR_ARGS[1], value: '3' },
      { ...NEAR_ARGS[2], value: 'snt' },
    ]);
    expect(saveButton().disabled).toBe(true);
  });

  it('should reject negative distances', async () => {
    const { user } = await setup(NEAR_ARGS);
    const min = screen.getByRole('spinbutton', { name: 'min.distance' });
    await user.type(min, '-1');
    await user.tab();
    expect(screen.getByText('value too low')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('should reject a treshold above 1 and accept decimals', async () => {
    const { user, argsChange } = await setup(FUZZY_ARGS);
    const t = screen.getByRole('spinbutton', { name: 'treshold' });
    await user.type(t, '1.5');
    await user.tab();
    expect(screen.getByText('value too big')).toBeTruthy();
    await user.clear(t);
    await user.type(t, '0.75');
    await user.click(saveButton());
    expect(argsChange).toHaveBeenCalledWith([{ ...FUZZY_ARGS[0], value: '0.75' }]);
  });

  it('should require required args', async () => {
    const { user } = await setup([{ id: 'r', label: 'req', required: true }]);
    const box = screen.getByRole('textbox', { name: 'req' });
    await user.type(box, 'x');
    await user.clear(box);
    await user.tab();
    expect(screen.getByText('value required')).toBeTruthy();
  });

  it('should validate numeric args pattern', async () => {
    const { fixture } = await setup([{ id: 'k', label: 'k', numeric: true }]);
    const control = fixture.componentInstance.arguments.at(0).get('value')!;
    control.setValue('1a5');
    expect(control.hasError('pattern')).toBe(true);
    control.setValue('1.5');
    expect(control.valid).toBe(true);
    control.setValue('-2');
    expect(control.valid).toBe(true);
  });

  it('should rebuild the controls when args change', async () => {
    const { args, fixture } = await setup(NEAR_ARGS);
    args.set(FUZZY_ARGS);
    await fixture.whenStable();
    expect(screen.queryByRole('spinbutton', { name: 'min.distance' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'treshold' })).toBeTruthy();
  });
});
