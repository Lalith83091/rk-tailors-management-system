import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-home',
  templateUrl: './home.html',
})
export class HomeComponent {
  menuOpen = false;
  bannerMissing = false;
  readonly year = new Date().getFullYear();
}
