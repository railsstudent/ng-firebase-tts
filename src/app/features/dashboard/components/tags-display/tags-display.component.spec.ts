import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TagsDisplayComponent } from './tags-display.component';

describe('TagsDisplayComponent', () => {
  let component: TagsDisplayComponent;
  let fixture: ComponentFixture<TagsDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagsDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TagsDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Dimension 1: Zero State & Base ARIA Contract', () => {
    it('should display fallback text when tags list is empty', () => {
      fixture.componentRef.setInput('tags', []);
      fixture.detectChanges();

      const fallbackEl = fixture.debugElement.query(By.css('.no-tags-message'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      expect(fallbackEl).toBeTruthy();
      expect(fallbackEl.nativeElement.textContent).toContain('No tags were generated for this image.');
      expect(options.length).toBe(0);
    });

    it('should configure listbox container with role="listbox" and horizontal orientation', () => {
      fixture.componentRef.setInput('tags', ['Mars', 'Landscape']);
      fixture.detectChanges();

      const listbox = fixture.debugElement.query(By.css('[ngListbox]'));
      expect(listbox).toBeTruthy();
      expect(listbox.nativeElement.getAttribute('role')).toBe('listbox');
      expect(listbox.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('should render options with role="option", initial aria-selected="false", and matching text', () => {
      const sampleTags = ['Mars', 'Landscape', 'Sunset'];
      fixture.componentRef.setInput('tags', sampleTags);
      fixture.detectChanges();

      const fallbackEl = fixture.debugElement.query(By.css('.no-tags-message'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      expect(fallbackEl).toBeNull();
      expect(options.length).toBe(3);

      options.forEach((opt, idx) => {
        expect(opt.nativeElement.getAttribute('role')).toBe('option');
        expect(opt.nativeElement.getAttribute('aria-selected')).toBe('false');
        expect(opt.nativeElement.textContent.trim()).toBe(sampleTags[idx]);
      });
    });
  });

  describe('Dimension 2: Mouse & Keyboard Selection Interactions', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('tags', ['Mars', 'Landscape', 'Sunset']);
      fixture.detectChanges();
    });

    it('should select an option on mouse click and update aria-selected to true', () => {
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));
      const secondOption = options[1].nativeElement;

      secondOption.click();
      fixture.detectChanges();

      expect(secondOption.getAttribute('aria-selected')).toBe('true');
      expect(options[0].nativeElement.getAttribute('aria-selected')).toBe('false');
      expect(options[2].nativeElement.getAttribute('aria-selected')).toBe('false');
    });

    it('should select the active option via Enter and Space keystrokes', () => {
      const listbox = fixture.debugElement.query(By.css('[ngListbox]'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      // Option 0 is active initially, press Enter to select it
      listbox.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(options[0].nativeElement.getAttribute('aria-selected')).toBe('true');

      // Navigate with ArrowRight to option 1, then select with Space
      listbox.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }),
      );
      fixture.detectChanges();

      listbox.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      fixture.detectChanges();

      expect(options[1].nativeElement.getAttribute('aria-selected')).toBe('true');
      expect(options[0].nativeElement.getAttribute('aria-selected')).toBe('false');
    });

    it('should enforce single-selection exclusivity by deselecting the previous tag', () => {
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      options[0].nativeElement.click();
      fixture.detectChanges();
      expect(options[0].nativeElement.getAttribute('aria-selected')).toBe('true');

      options[2].nativeElement.click();
      fixture.detectChanges();
      expect(options[0].nativeElement.getAttribute('aria-selected')).toBe('false');
      expect(options[2].nativeElement.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('Dimension 3: Roving Focus & Keyboard Navigation', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('tags', ['Alpha', 'Beta', 'Gamma']);
      fixture.detectChanges();
    });

    it('should enforce roving tabindex where only the active option has tabindex="0"', () => {
      const listbox = fixture.debugElement.query(By.css('[ngListbox]'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      expect(options[0].nativeElement.getAttribute('tabindex')).toBe('0');
      expect(options[1].nativeElement.getAttribute('tabindex')).toBe('-1');
      expect(options[2].nativeElement.getAttribute('tabindex')).toBe('-1');

      listbox.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }),
      );
      fixture.detectChanges();

      expect(options[0].nativeElement.getAttribute('tabindex')).toBe('-1');
      expect(options[1].nativeElement.getAttribute('tabindex')).toBe('0');
      expect(options[2].nativeElement.getAttribute('tabindex')).toBe('-1');
    });

    it('should navigate horizontally using ArrowRight and ArrowLeft keys', () => {
      const listbox = fixture.debugElement.query(By.css('[ngListbox]'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      listbox.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }),
      );
      fixture.detectChanges();

      expect(options[1].nativeElement.getAttribute('tabindex')).toBe('0');
      expect(options[0].nativeElement.getAttribute('tabindex')).toBe('-1');

      listbox.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }),
      );
      fixture.detectChanges();

      expect(options[0].nativeElement.getAttribute('tabindex')).toBe('0');
      expect(options[1].nativeElement.getAttribute('tabindex')).toBe('-1');
    });

    it('should navigate to boundaries using Home and End keys', () => {
      const listbox = fixture.debugElement.query(By.css('[ngListbox]'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      listbox.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', code: 'End', bubbles: true }));
      fixture.detectChanges();

      expect(options[2].nativeElement.getAttribute('tabindex')).toBe('0');

      listbox.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', code: 'Home', bubbles: true }));
      fixture.detectChanges();

      expect(options[0].nativeElement.getAttribute('tabindex')).toBe('0');
    });

    it('should wrap navigation from first option to last option on ArrowLeft (default wrap=true)', () => {
      const listbox = fixture.debugElement.query(By.css('[ngListbox]'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      // Option 0 is active. ArrowLeft wraps to the last option (option 2)
      listbox.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }),
      );
      fixture.detectChanges();

      expect(options[2].nativeElement.getAttribute('tabindex')).toBe('0');
      expect(options[0].nativeElement.getAttribute('tabindex')).toBe('-1');
      expect(options[1].nativeElement.getAttribute('tabindex')).toBe('-1');
    });

    it('should jump to matching option when typing characters (typeahead search)', () => {
      const listbox = fixture.debugElement.query(By.css('[ngListbox]'));
      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));

      listbox.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'G', bubbles: true }));
      fixture.detectChanges();

      expect(options[2].nativeElement.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('Dimension 4: Reactivity & Edge Cases', () => {
    it('should correctly render and label tags with special characters and whitespace', () => {
      const specialTags = ['#Deep-Learning & AI', 'Audio / Speech 🎙️'];
      fixture.componentRef.setInput('tags', specialTags);
      fixture.detectChanges();

      const options = fixture.debugElement.queryAll(By.css('[ngOption]'));
      expect(options.length).toBe(2);
      expect(options[0].nativeElement.textContent.trim()).toBe('#Deep-Learning & AI');
      expect(options[1].nativeElement.textContent.trim()).toBe('Audio / Speech 🎙️');
    });

    it('should cleanly handle input array reduction without runtime errors', () => {
      fixture.componentRef.setInput('tags', ['Tag 1', 'Tag 2', 'Tag 3']);
      fixture.detectChanges();

      const optionsBefore = fixture.debugElement.queryAll(By.css('[ngOption]'));
      optionsBefore[2].nativeElement.click();
      fixture.detectChanges();

      // Reduce array to 1 tag
      fixture.componentRef.setInput('tags', ['Tag 1']);
      fixture.detectChanges();

      const optionsAfter = fixture.debugElement.queryAll(By.css('[ngOption]'));
      expect(optionsAfter.length).toBe(1);
      expect(optionsAfter[0].nativeElement.textContent.trim()).toBe('Tag 1');
    });
  });
});
