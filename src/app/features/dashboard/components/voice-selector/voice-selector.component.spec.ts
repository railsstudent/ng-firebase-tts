import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SORTED_VOICE_OPTIONS } from './constants/voice-options.const';
import { VoiceSelectorComponent } from './voice-selector.component';

describe('VoiceSelectorComponent', () => {
  let component: VoiceSelectorComponent;
  let fixture: ComponentFixture<VoiceSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoiceSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Seam 1: Data Model & Lookup Consistency', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should sort prebuilt voice options alphabetically by name', () => {
      const voiceOptions = component.sortedVoiceOptions;
      expect(voiceOptions.length).toBe(SORTED_VOICE_OPTIONS.length);

      for (let i = 0; i < voiceOptions.length - 1; i = i + 1) {
        expect(voiceOptions[i].name.localeCompare(voiceOptions[i + 1].name)).toBeLessThanOrEqual(0);
      }
    });

    it('should map each voice name to its formatted label in sortedVoiceMap', () => {
      const map = component.sortedVoiceMap;
      expect(map.size).toBe(SORTED_VOICE_OPTIONS.length);

      SORTED_VOICE_OPTIONS.forEach((voice) => {
        expect(map.get(voice.name)).toBe(voice.label);
      });
    });

    it('should compute displayLabel from selectedValues with default fallback', () => {
      expect(component.displayLabel()).toContain(DEFAULT_VOICE);

      component.selectedValues.set(['Zephyr']);
      expect(component.displayLabel()).toContain('Zephyr');

      component.selectedValues.set(['NonExistentVoice']);
      expect(component.displayLabel()).toContain(DEFAULT_VOICE);

      component.selectedValues.set([]);
      expect(component.displayLabel()).toContain(DEFAULT_VOICE);
    });
  });

  describe('Seam 2: ARIA & Accessibility Contract', () => {
    it('should expose combobox trigger with role="combobox" and aria-expanded="false" on init', () => {
      const comboboxEl = fixture.debugElement.query(By.css('[ngCombobox]'));
      expect(comboboxEl).toBeTruthy();
      expect(comboboxEl.attributes['role']).toBe('combobox');
      expect(comboboxEl.attributes['aria-expanded']).toBe('false');
      expect(comboboxEl.attributes['tabindex']).toBe('0');
    });

    it('should render overlay listbox with role="listbox" when expanded', () => {
      component.popupExpanded.set(true);
      fixture.detectChanges();

      const listboxEl = fixture.debugElement.query(By.css('[ngListbox]'));
      expect(listboxEl).toBeTruthy();
      expect(listboxEl.attributes['role']).toBe('listbox');
      expect(listboxEl.attributes['tabindex']).toBe('-1');
    });

    it('should render all voice options with role="option" and mark active voice as aria-selected="true"', () => {
      component.popupExpanded.set(true);
      fixture.detectChanges();

      const optionEls = fixture.debugElement.queryAll(By.css('[ngOption]'));
      expect(optionEls.length).toBe(SORTED_VOICE_OPTIONS.length);

      const koreOption = optionEls.find((el) => el.nativeElement.textContent.includes(DEFAULT_VOICE));
      expect(koreOption).toBeTruthy();
      expect(koreOption?.attributes['aria-selected']).toBe('true');

      const nonKoreOptions = optionEls.filter((el) => el !== koreOption);
      nonKoreOptions.forEach((opt) => {
        expect(opt.attributes['aria-selected']).toBe('false');
      });
    });

    it('should annotate icon elements with aria-hidden="true" and translate="no"', () => {
      const triggerIcon = fixture.debugElement.query(By.css('.voice-trigger-left span[translate="no"]'));
      expect(triggerIcon?.attributes['aria-hidden']).toBe('true');
      expect(triggerIcon?.attributes['translate']).toBe('no');

      component.popupExpanded.set(true);
      fixture.detectChanges();

      const checkIcons = fixture.debugElement.queryAll(By.css('.option-check'));
      expect(checkIcons.length).toBeGreaterThan(0);
      expect(checkIcons[0].attributes['aria-hidden']).toBe('true');
      expect(checkIcons[0].attributes['translate']).toBe('no');
    });
  });

  describe('Seam 3: User Interaction & Output Emission', () => {
    it('should emit valueChange output and update selectedValues on onValueChange', () => {
      let emittedValue = '';
      component.valueChange.subscribe((val) => (emittedValue = val));

      component.onValueChange(['Puck']);
      fixture.detectChanges();

      expect(component.selectedValues()).toEqual(['Puck']);
      expect(emittedValue).toBe('Puck');
      expect(component.displayLabel()).toContain('Puck');
    });

    it('should fall back to DEFAULT_VOICE when onValueChange receives empty array', () => {
      let emittedValue = '';
      component.valueChange.subscribe((val) => (emittedValue = val));

      component.onValueChange([]);
      fixture.detectChanges();

      expect(emittedValue).toBe(DEFAULT_VOICE);
    });

    it('should emit valueChange when template listbox emits valueChange', () => {
      let emittedValue = '';
      component.valueChange.subscribe((val) => (emittedValue = val));

      component.popupExpanded.set(true);
      fixture.detectChanges();

      const listboxEl = fixture.debugElement.query(By.css('[ngListbox]'));
      listboxEl.triggerEventHandler('valueChange', ['Fenrir']);
      fixture.detectChanges();

      expect(emittedValue).toBe('Fenrir');
      expect(component.selectedValues()).toEqual(['Fenrir']);
    });

    it('should close the popup when onCommit is called or listbox is committed via click/Enter/Space', () => {
      component.popupExpanded.set(true);
      fixture.detectChanges();

      const listboxEl = fixture.debugElement.query(By.css('[ngListbox]'));

      // Test click event
      listboxEl.triggerEventHandler('click', new MouseEvent('click'));
      expect(component.popupExpanded()).toBe(false);

      // Test enter keydown
      component.popupExpanded.set(true);
      fixture.detectChanges();
      listboxEl.triggerEventHandler('keydown.enter', new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(component.popupExpanded()).toBe(false);

      // Test space keydown
      component.popupExpanded.set(true);
      fixture.detectChanges();
      listboxEl.triggerEventHandler('keydown.space', new KeyboardEvent('keydown', { key: ' ' }));
      expect(component.popupExpanded()).toBe(false);
    });
  });

  describe('Seam 4: Visual State & CSS Class Verification', () => {
    it('should apply trigger classes to the combobox host', () => {
      const triggerEl = fixture.debugElement.query(By.css('[ngCombobox]'));
      expect(triggerEl.nativeElement.classList.contains('form-field-select')).toBe(true);
      expect(triggerEl.nativeElement.classList.contains('voice-trigger')).toBe(true);
    });

    it('should include voice arrow and option check elements in the template', () => {
      const arrowEl = fixture.debugElement.query(By.css('.voice-arrow'));
      expect(arrowEl).toBeTruthy();

      component.popupExpanded.set(true);
      fixture.detectChanges();

      const optionCheckEls = fixture.debugElement.queryAll(By.css('.option-check'));
      expect(optionCheckEls.length).toBe(SORTED_VOICE_OPTIONS.length);
    });
  });
});
