import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Document } from '@myrmidon/pythia-core';

/**
 * Component used to display information about a document.
 */
@Component({
  selector: 'pythia-document-info',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './document-info.component.html',
  styleUrls: ['./document-info.component.css'],
})
export class DocumentInfoComponent {
  /**
   * Document to display.
   */
  public readonly document = input<Document | undefined | null>();

  /**
   * Event emitted when the user requests to close the info.
   */
  public readonly closeRequest = output<Document>();

  /**
   * Event emitted when the user requests to read the document.
   */
  public readonly readRequest = output<Document>();

  public read(): void {
    const document = this.document();
    if (document) {
      this.readRequest.emit(document);
    }
  }

  public close(): void {
    this.closeRequest.emit(this.document()!);
  }
}
