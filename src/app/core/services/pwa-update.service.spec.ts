import { IS_BROWSER, WINDOW } from '@/core/constants/navigator.const';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { PwaUpdateService } from './pwa-update.service';

describe('PwaUpdateService', () => {
  let swUpdateMock: { isEnabled: boolean; versionUpdates: Subject<VersionReadyEvent> };
  let isBrowserMock: boolean;
  let windowMock: { location: { reload: () => void } };
  let reloadCalled: boolean;

  beforeEach(() => {
    reloadCalled = false;
    swUpdateMock = {
      isEnabled: true,
      versionUpdates: new Subject<VersionReadyEvent>(),
    };
    isBrowserMock = true;
    windowMock = {
      location: {
        reload: () => {
          reloadCalled = true;
        },
      },
    };
  });

  function createService(): PwaUpdateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PwaUpdateService,
        { provide: SwUpdate, useValue: swUpdateMock },
        { provide: IS_BROWSER, useFactory: () => isBrowserMock },
        { provide: WINDOW, useValue: windowMock },
      ],
    });
    return TestBed.inject(PwaUpdateService);
  }

  it('should initialize updateAvailable as false', () => {
    const service = createService();
    expect(service.updateAvailable()).toBe(false);
  });

  it('should emit true when isBrowser is true, SwUpdate is enabled, and VERSION_READY is fired', () => {
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(true);
  });

  it('should ignore other event types (e.g. VERSION_DETECTED)', () => {
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_DETECTED',
      version: { hash: 'v2' },
    } as unknown as VersionReadyEvent);
    expect(service.updateAvailable()).toBe(false);
  });

  it('should not emit true when IS_BROWSER is false', () => {
    isBrowserMock = false;
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(false);
  });

  it('should not emit true when SwUpdate.isEnabled is false', () => {
    swUpdateMock.isEnabled = false;
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(false);
  });

  it('should call window.location.reload() when reloadPage() is called in browser', () => {
    const service = createService();
    service.reloadPage();
    expect(reloadCalled).toBe(true);
  });

  it('should not call window.location.reload() when reloadPage() is called in SSR', () => {
    isBrowserMock = false;
    const service = createService();
    service.reloadPage();
    expect(reloadCalled).toBe(false);
  });
});
