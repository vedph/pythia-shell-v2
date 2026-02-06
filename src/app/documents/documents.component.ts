import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';

import { DocumentReadRequest } from '@myrmidon/pythia-core';

import { DocumentListComponent } from '@myrmidon/pythia-document-list';
import { DocumentReaderComponent } from '@myrmidon/pythia-document-reader';

@Component({
  selector: 'app-documents',
  imports: [
    MatCardModule,
    MatExpansionModule,
    DocumentListComponent,
    DocumentReaderComponent,
  ],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsComponent {
  public readonly readRequest = signal<DocumentReadRequest | undefined>(
    undefined
  );

  public onReadRequest(readRequest: DocumentReadRequest): void {
    this.readRequest.set({ ...readRequest, initialPath: '0' });
  }
}
