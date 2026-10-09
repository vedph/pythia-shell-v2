import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField, debounce, form } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable } from 'rxjs';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TextMapNode } from '@myrmidon/pythia-core';
import {
  BrowserTreeNodeComponent,
  PageChangeRequest,
  PagedTreeStore,
} from '@myrmidon/paged-data-browsers';

import {
  FlatMapNode,
  FlatMapNodeFilter,
  MapPagedTreeStoreService,
} from '../map-paged-tree-store.service';

/**
 * A component that displays a paged tree browser for a text map.
 */
@Component({
  selector: 'pythia-map-paged-tree-browser',
  imports: [
    CommonModule,
    FormField,
    // material
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    // myrmidon
    BrowserTreeNodeComponent,
  ],
  templateUrl: './map-paged-tree-browser.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './map-paged-tree-browser.component.scss',
})
export class MapPagedTreeBrowserComponent {
  private _store?: PagedTreeStore<FlatMapNode, FlatMapNodeFilter>;
  private _service?: MapPagedTreeStoreService;

  /**
   * The root node of the map to display.
   */
  public readonly map = input.required<TextMapNode | undefined>();

  /**
   * Whether to show debug information.
   */
  public readonly debug = input<boolean>();

  /**
   * The minimum map nodes count treshold for showing the filter.
   */
  public filterTreshold = input<number>(0);

  /**
   * Whether to hide the full document button.
   */
  public readonly hideFullDocument = input<boolean>(false);

  /**
   * Emits when a map node is clicked.
   */
  public readonly mapNodeClick = output<TextMapNode>();

  /**
   * The label filter. Its model value is debounced, so that the store is
   * filtered only once the user pauses typing; the control value
   * (`controlValue()`) is immediate.
   */
  public readonly filterForm = form(signal({ label: '' }), (path) => {
    debounce(path.label, 300);
  });
  // signals, because they are replaced whenever the map changes
  public readonly nodes$ = signal<
    Observable<readonly FlatMapNode[] | undefined> | undefined
  >(undefined);
  public readonly filter$ = signal<
    Observable<FlatMapNodeFilter | undefined> | undefined
  >(undefined);

  constructor() {
    // apply the (debounced) label filter to the current store
    effect(() => {
      const label = this.filterForm.label().value();
      untracked(() => this._store?.setFilter({ label }));
    });

    effect(() => {
      this.updateTree(this.map());
    });
  }

  public resetLabelFilter(): void {
    this.filterForm.label().value.set('');
  }

  private updateTree(map: TextMapNode | undefined): void {
    if (map) {
      this._service = new MapPagedTreeStoreService(map);
      this._store = new PagedTreeStore(this._service);
      this.nodes$.set(this._store.nodes$);
      this.filter$.set(this._store.filter$);
      this._store.reset();
    } else {
      this._service = undefined;
      this._store = undefined;
      this.nodes$.set(undefined);
      this.filter$.set(undefined);
    }
  }

  public onToggleExpanded(node: FlatMapNode): void {
    if (!this._store) {
      return;
    }
    if (node.expanded) {
      this._store.collapse(node.id);
    } else {
      this._store.expand(node.id);
    }
  }

  public onPageChangeRequest(request: PageChangeRequest): void {
    if (!this._store) {
      return;
    }
    this._store.changePage(request.node.id, request.paging.pageNumber);
  }

  public onMapNodeClick(node: FlatMapNode): void {
    this.mapNodeClick.emit(node.payload);
  }

  public showFullDocument(): void {
    if (this.map()) {
      this.mapNodeClick.emit(this.map()!);
    }
  }
}
