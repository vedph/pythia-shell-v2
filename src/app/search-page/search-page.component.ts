import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';

import { SearchComponent } from '../../../projects/myrmidon/pythia-search/src/public-api';

@Component({
  selector: 'app-search',
  imports: [MatCardModule, SearchComponent],
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.css'],
})
export class SearchPageComponent {
  public initialQueryTerm: string | undefined;

  constructor(route: ActivatedRoute) {
    if ('term' in route.snapshot.params) {
      this.initialQueryTerm = route.snapshot.params['term'];
    }
  }
}
