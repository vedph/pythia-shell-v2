
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';

import { Lemma, Word } from '@myrmidon/pythia-api';

import { WordIndexComponent } from '@myrmidon/pythia-word-index';

@Component({
  selector: 'app-words',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    WordIndexComponent
],
  templateUrl: './words-page.component.html',
  styleUrl: './words-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordsPageComponent {
  constructor(private _router: Router) {}

  public onSearchRequest(token: Word | Lemma): void {
    if (token.type === 'lemma') {
      this._router.navigate(['search', '^' + token.value]);
    } else {
      this._router.navigate(['search', token.value]);
    }
  }
}
