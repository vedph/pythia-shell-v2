import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WordsPageComponent } from './words-page.component';

describe('WordsComponent', () => {
  let component: WordsPageComponent;
  let fixture: ComponentFixture<WordsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordsPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WordsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
