import { Component } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CorpusListComponent } from '@myrmidon/pythia-corpus-list';

@Component({
  selector: 'app-corpora',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    CorpusListComponent,
  ],
  templateUrl: './corpora.component.html',
  styleUrls: ['./corpora.component.css'],
})
export class CorporaComponent {}
