import { Component } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';

import { DocumentReadRequest } from '@myrmidon/pythia-core';

import { DocumentListComponent } from '../../../projects/myrmidon/pythia-document-list/src/public-api';
import { DocumentReaderComponent } from '../../../projects/myrmidon/pythia-document-reader/src/public-api';

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
})
export class DocumentsComponent {
  public readRequest?: DocumentReadRequest;

  public onReadRequest(readRequest: DocumentReadRequest): void {
    this.readRequest = { ...readRequest, initialPath: '0' };
  }
}
