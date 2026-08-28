import { TestBed } from '@angular/core/testing';
import { App } from './app';

import { SwUpdate } from '@angular/service-worker';
import { IS_BROWSER, WINDOW } from '@/core/constants/navigator.const';
import { EMPTY } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: EMPTY,
          },
        },
        {
          provide: IS_BROWSER,
          useValue: true,
        },
        {
          provide: WINDOW,
          useValue: {
            location: {
              reload: () => {
                // No-op for testing
              },
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, ng-firebase-tts');
  });
});
