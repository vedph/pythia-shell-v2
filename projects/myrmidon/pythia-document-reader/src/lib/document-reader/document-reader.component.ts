import { Component, effect, input, ViewEncapsulation } from '@angular/core';
import { Observable } from 'rxjs';

import { ReaderService } from '@myrmidon/pythia-api';
import {
  Document,
  DocumentReadRequest,
  TextMapNode,
} from '@myrmidon/pythia-core';

import { DocumentReaderRepository } from '../document-reader.repository';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { MapPagedTreeBrowserComponent } from '../map-paged-tree-browser/map-paged-tree-browser.component';

/**
 * Document text reader component.
 */
@Component({
  selector: 'pythia-document-reader',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    // material
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    // Pythia
    MapPagedTreeBrowserComponent,
  ],
  templateUrl: './document-reader.component.html',
  styleUrls: ['./document-reader.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class DocumentReaderComponent {
  private _busy: boolean | undefined;

  public readonly request = input<DocumentReadRequest | undefined>();

  /**
   * Whether to show debug information.
   */
  public readonly debug = input<boolean | undefined>();

  /**
   * Whether to hide the map.
   */
  public readonly hideMap = input<boolean | undefined>();

  /**
   * The minimum map nodes count treshold for showing the filter.
   */
  public readonly filterTreshold = input<number>(0);

  public loading$: Observable<boolean>;
  public document$: Observable<Document | undefined>;
  public map$: Observable<TextMapNode | undefined>;
  public text$: Observable<string | undefined>;

  constructor(
    private _repository: DocumentReaderRepository,
    private _readerService: ReaderService,
  ) {
    this.loading$ = _repository.loading$;
    this.document$ = _repository.document$;
    this.map$ = _repository.map$;
    this.text$ = _repository.text$;

    effect(() => {
      const request = this.request();
      if (request) {
        this._repository.load(request, request.initialPath);
      } else {
        this._repository.reset();
      }
    });
  }

  public onMapNodeClick(node: TextMapNode): void {
    if (this._busy) {
      return;
    }
    this._busy = true;
    const path = this._readerService.getNodePath(node);
    this._repository.loadTextFromPath(path).finally(() => {
      this._busy = false;
    });
  }
}
