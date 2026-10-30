import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('references the required banner image without substituting another asset', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.shop-banner') as HTMLImageElement;
    expect(banner.getAttribute('src')).toBe('/assets/images/rk-tailors-banner.png');
    expect(banner.alt).toContain('R.K. Tailors');
  });

  it('shows the shop contact details on the public homepage', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('92921 51645');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('V. Purushottam');
  });
});
