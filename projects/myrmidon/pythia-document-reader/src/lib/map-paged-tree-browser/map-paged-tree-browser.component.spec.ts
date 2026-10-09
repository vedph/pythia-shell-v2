import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { TextMapNode } from '@myrmidon/pythia-core';

import { MapPagedTreeBrowserComponent } from './map-paged-tree-browser.component';

function node(
  label: string,
  start: number,
  children?: TextMapNode[],
): TextMapNode {
  const n: TextMapNode = { label, location: label, start, end: start + 10, children };
  children?.forEach((c) => (c.parent = n));
  return n;
}

function buildMap(): TextMapNode {
  return node('root', 0, [
    node('book 1', 0, [node('chapter 1', 0), node('chapter 2', 5)]),
    node('book 2', 10),
  ]);
}

async function setup(
  options: {
    map?: TextMapNode;
    hideFullDocument?: boolean;
    filterTreshold?: number;
  } = {},
) {
  const map = signal<TextMapNode | undefined>(options.map ?? buildMap());
  const mapNodeClick = vi.fn();
  const result = await render(MapPagedTreeBrowserComponent, {
    bindings: [
      inputBinding('map', map),
      inputBinding('hideFullDocument', signal(options.hideFullDocument ?? false)),
      inputBinding('filterTreshold', signal(options.filterTreshold ?? 0)),
      outputBinding('mapNodeClick', mapNodeClick),
    ],
  });
  await result.fixture.whenStable();
  return { ...result, map, mapNodeClick, user: userEvent.setup() };
}

/** Get the tree node element displaying the specified label. */
const treeNode = (label: string): HTMLElement =>
  screen
    .getByText(new RegExp(`${label}\\s*$`))
    .closest<HTMLElement>('pdb-browser-tree-node')!;

describe('MapPagedTreeBrowserComponent', () => {
  it('should show the root node', async () => {
    await setup();
    expect(treeNode('root')).toBeTruthy();
    expect(screen.queryByText(/book 1/)).toBeNull();
  });

  it('should expand and collapse nodes sharing the same start', async () => {
    const { user } = await setup();
    await user.click(within(treeNode('root')).getByRole('button'));
    expect(await screen.findByText(/book 1/)).toBeTruthy();
    expect(screen.getByText(/book 2/)).toBeTruthy();
    // book 1 starts at 0 like root: expanding it must show its children
    await user.click(within(treeNode('book 1')).getByRole('button'));
    expect(await screen.findByText(/chapter 1/)).toBeTruthy();
    expect(screen.getByText(/chapter 2/)).toBeTruthy();
    // collapse root
    await user.click(within(treeNode('root')).getByRole('button'));
    expect(screen.queryByText(/book 1/)).toBeNull();
  });

  it('should emit the clicked map node', async () => {
    const { user, mapNodeClick, map } = await setup();
    await user.click(within(treeNode('root')).getByRole('button'));
    await screen.findByText(/book 2/);
    mapNodeClick.mockClear();
    await user.click(screen.getByText(/book 2/));
    expect(mapNodeClick).toHaveBeenCalledWith(map()!.children![1]);
  });

  it('should emit the whole map for full document', async () => {
    const { user, mapNodeClick, map } = await setup();
    await user.click(screen.getByRole('button', { name: 'Whole document' }));
    expect(mapNodeClick).toHaveBeenCalledWith(map());
  });

  it('should hide full document button when requested', async () => {
    await setup({ hideFullDocument: true });
    expect(
      screen.queryByRole('button', { name: 'Whole document' }),
    ).toBeNull();
  });

  it('should hide the filter under the threshold', async () => {
    await setup({ filterTreshold: 5 });
    expect(screen.queryByRole('textbox', { name: 'filter' })).toBeNull();
  });

  it('should filter child nodes by label and clear the filter', async () => {
    const { user } = await setup();
    await user.click(within(treeNode('root')).getByRole('button'));
    await screen.findByText(/book 1/);
    const clear = screen.getByRole('button', {
      name: 'Clear filter',
    }) as HTMLButtonElement;
    expect(clear.disabled).toBe(true);

    await user.type(screen.getByRole('textbox', { name: 'filter' }), '2');
    // filter is debounced
    await vi.waitFor(() => expect(screen.queryByText(/book 1/)).toBeNull());
    await user.click(within(treeNode('root')).getByRole('button'));
    await screen.findByText(/book 2/);
    expect(screen.queryByText(/book 1/)).toBeNull();

    expect(clear.disabled).toBe(false);
    await user.click(clear);
    expect(
      (screen.getByRole('textbox', { name: 'filter' }) as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('should enable clear at once but filter only after a pause', async () => {
    const { user, fixture } = await setup();
    await user.click(within(treeNode('root')).getByRole('button'));
    await screen.findByText(/book 1/);

    await user.type(screen.getByRole('textbox', { name: 'filter' }), '2');
    fixture.detectChanges();
    // the control value is immediate...
    expect(
      (screen.getByRole('button', { name: 'Clear filter' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    // ...the filter is not applied yet
    expect(screen.queryByText(/book 1/)).toBeTruthy();
    expect(fixture.componentInstance.filterForm.label().value()).toBe('');

    await vi.waitFor(() =>
      expect(fixture.componentInstance.filterForm.label().value()).toBe('2'),
    );
  });

  it('should render no <form> element', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('should clear the tree when map is removed', async () => {
    const { map, fixture } = await setup();
    map.set(undefined);
    await fixture.whenStable();
    expect(screen.queryByText(/root/)).toBeNull();
  });
});
