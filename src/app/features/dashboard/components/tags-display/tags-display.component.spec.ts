import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TagsDisplayComponent } from './tags-display.component';
import { By } from '@angular/platform-browser';

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

  // TEST CASE 1: Empty Tags State
  it('should display fallback text when tags list is empty', () => {
    fixture.componentRef.setInput('tags', []);
    fixture.detectChanges();

    const fallbackEl = fixture.debugElement.query(By.css('.no-tags-message'));
    const tagPills = fixture.debugElement.queryAll(By.css('.tag-pill'));

    expect(fallbackEl).toBeTruthy();
    expect(fallbackEl.nativeElement.textContent).toContain('No tags were generated for this image.');
    expect(tagPills.length).toBe(0);
  });

  // TEST CASE 2: Render Multiple Tags
  it('should render correct number of tag pills with correct content', () => {
    fixture.componentRef.setInput('tags', ['Mars', 'Landscape', 'Sunset']);
    fixture.detectChanges();

    const fallbackEl = fixture.debugElement.query(By.css('.no-tags-message'));
    const tagPills = fixture.debugElement.queryAll(By.css('.tag-pill'));

    expect(fallbackEl).toBeNull();
    expect(tagPills.length).toBe(3);
    expect(tagPills[0].nativeElement.textContent.trim()).toBe('Mars');
    expect(tagPills[1].nativeElement.textContent.trim()).toBe('Landscape');
    expect(tagPills[2].nativeElement.textContent.trim()).toBe('Sunset');
  });
});
