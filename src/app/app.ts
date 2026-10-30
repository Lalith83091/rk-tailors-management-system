import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastOutletComponent } from './shared/toast-outlet';

@Component({
  imports: [RouterOutlet, ToastOutletComponent],
  selector: 'app-root',
  template: '<app-toast-outlet /><router-outlet />',
})
export class App {}
