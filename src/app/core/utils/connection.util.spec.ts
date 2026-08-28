import { injectOnlineStatus } from './connection.util';
import { TestBed } from '@angular/core/testing';
import { NAVIGATOR } from '@/core/constants/navigator.const';

describe('connection.util', () => {
  let navigatorMock: { onLine: boolean };

  beforeEach(() => {
    navigatorMock = { onLine: true };
  });

  function setupStatusFn(navigatorVal: unknown): () => boolean {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: NAVIGATOR, useValue: navigatorVal }],
    });

    let statusFn!: () => boolean;
    TestBed.runInInjectionContext(() => {
      statusFn = injectOnlineStatus();
    });
    return statusFn;
  }

  it('Case 2.1: should return true when navigator is online and dynamically update when offline', () => {
    const statusFn = setupStatusFn(navigatorMock);

    expect(statusFn()).toBe(true);

    navigatorMock.onLine = false;
    expect(statusFn()).toBe(false);
  });

  it('Case 2.2: should return true as a fallback if navigator injection is null or missing onLine property', () => {
    const statusFn = setupStatusFn(null);
    expect(statusFn()).toBe(true);

    const emptyNavigatorFn = setupStatusFn({});
    expect(emptyNavigatorFn()).toBe(true);
  });
});
