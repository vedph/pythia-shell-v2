import { firstValueFrom } from 'rxjs';

import { TextMapNode } from '@myrmidon/pythia-core';

import { FlatMapNode, MapPagedTreeStoreService } from './map-paged-tree-store.service';

function node(
  label: string,
  start: number,
  end: number,
  children?: TextMapNode[],
): TextMapNode {
  const n: TextMapNode = { label, location: label, start, end, children };
  children?.forEach((c) => (c.parent = n));
  return n;
}

// root (0-100)
// +-- book 1 (0-50)       <- same start as root
// |   +-- chapter 1 (0-20) <- same start as root and book
// |   +-- chapter 2 (20-50)
// +-- book 2 (50-100)
//     (empty children)
function buildMap(): TextMapNode {
  return node('root', 0, 100, [
    node('book 1', 0, 50, [node('chapter 1', 0, 20), node('chapter 2', 20, 50)]),
    node('book 2', 50, 100, []),
  ]);
}

async function getNodes(
  service: MapPagedTreeStoreService,
  filter: { parentId?: number; label?: string },
  pageNumber = 1,
  pageSize = 20,
): Promise<FlatMapNode[]> {
  const page = await firstValueFrom(
    service.getNodes(filter, pageNumber, pageSize),
  );
  return page.items as FlatMapNode[];
}

describe('MapPagedTreeStoreService', () => {
  it('should return only the root at the root level', async () => {
    const service = new MapPagedTreeStoreService(buildMap());
    const roots = await getNodes(service, {});
    expect(roots.map((n) => n.label)).toEqual(['root']);
    expect(roots[0].parentId).toBeUndefined();
    expect(roots[0].y).toBe(1);
    expect(roots[0].x).toBe(0);
    expect(roots[0].hasChildren).toBe(true);
  });

  it('should assign unique IDs even when nodes share the same start', async () => {
    const service = new MapPagedTreeStoreService(buildMap());
    const [root] = await getNodes(service, {});
    const books = await getNodes(service, { parentId: root.id });
    const chapters = await getNodes(service, { parentId: books[0].id });
    const ids = [root, ...books, ...chapters].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id > 0)).toBe(true);
  });

  it('should return the children of a node with their position', async () => {
    const service = new MapPagedTreeStoreService(buildMap());
    const [root] = await getNodes(service, {});
    const books = await getNodes(service, { parentId: root.id });
    expect(books.map((n) => n.label)).toEqual(['book 1', 'book 2']);
    expect(books.map((n) => [n.y, n.x])).toEqual([
      [2, 1],
      [2, 2],
    ]);
    const chapters = await getNodes(service, { parentId: books[0].id });
    expect(chapters.map((n) => n.label)).toEqual(['chapter 1', 'chapter 2']);
    expect(chapters[1].payload.start).toBe(20);
  });

  it('should not mark nodes with empty children as expandable', async () => {
    const service = new MapPagedTreeStoreService(buildMap());
    const [root] = await getNodes(service, {});
    const books = await getNodes(service, { parentId: root.id });
    expect(books[0].hasChildren).toBe(true);
    expect(books[1].hasChildren).toBe(false);
  });

  it('should filter non-root nodes by label', async () => {
    const service = new MapPagedTreeStoreService(buildMap());
    const [root] = await getNodes(service, { label: 'xyz' });
    // root is never filtered out
    expect(root.label).toBe('root');
    const books = await getNodes(service, { parentId: root.id, label: '2' });
    expect(books.map((n) => n.label)).toEqual(['book 2']);
  });

  it('should page the nodes', async () => {
    const service = new MapPagedTreeStoreService(buildMap());
    const [root] = await getNodes(service, {});
    const page = await firstValueFrom(
      service.getNodes({ parentId: root.id }, 2, 1),
    );
    expect(page.items.map((n) => n.label)).toEqual(['book 2']);
    expect(page.pageNumber).toBe(2);
    expect(page.pageSize).toBe(1);
    expect(page.pageCount).toBe(2);
    expect(page.total).toBe(2);
  });
});
