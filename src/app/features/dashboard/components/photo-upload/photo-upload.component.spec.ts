import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotoUploadComponent } from './photo-upload.component';
import { PhotoIconComponent } from '@/shared/ui/icons/photo-icon.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { By } from '@angular/platform-browser';

describe('PhotoUploadComponent', () => {
  let component: PhotoUploadComponent;
  let fixture: ComponentFixture<PhotoUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoUploadComponent, PhotoIconComponent, SpinnerIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoUploadComponent);
    component = fixture.componentInstance;

    // Provide default inputs
    fixture.componentRef.setInput('acceptedFileTypes', ['image/jpeg', 'image/png', 'image/jpg']);
    fixture.componentRef.setInput('isLoading', false);
    fixture.componentRef.setInput('previewUrl', undefined);

    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Default Empty State
  it('should display the dropzone when previewUrl is empty', () => {
    const dropzone = fixture.debugElement.query(By.css('.dropzone'));
    const previewImage = fixture.debugElement.query(By.css('.preview-image'));

    expect(dropzone).toBeTruthy();
    expect(previewImage).toBeNull();
  });

  // TEST CASE 2: Preview State Rendering
  it('should render the preview image and hide dropzone when previewUrl is provided', () => {
    fixture.componentRef.setInput('previewUrl', 'blob:http://localhost/test-uuid');
    fixture.detectChanges();

    const dropzone = fixture.debugElement.query(By.css('.dropzone'));
    const previewImage = fixture.debugElement.query(By.css('.preview-image'));

    expect(dropzone).toBeNull();
    expect(previewImage).toBeTruthy();
    expect(previewImage.nativeElement.getAttribute('src')).toBe('blob:http://localhost/test-uuid');
  });

  // TEST CASE 3: Loading State
  it('should disable the generate button and show spinner when isLoading is true', () => {
    fixture.componentRef.setInput('previewUrl', 'blob:http://localhost/test-uuid');
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const generateBtn = fixture.debugElement.query(By.css('.btn-generate'));
    const spinner = fixture.debugElement.query(By.css('.spinner'));

    expect(generateBtn.nativeElement.disabled).toBe(true);
    expect(spinner).toBeTruthy();
  });

  // TEST CASE 4: Drag Interaction (Visual Indicators)
  it('should apply drag-active class on dragover and remove on dragleave', () => {
    const dropzone = fixture.debugElement.query(By.css('.dropzone')).nativeElement as HTMLElement;

    // Trigger dragover
    dropzone.dispatchEvent(new CustomEvent('dragover'));
    fixture.detectChanges();
    expect(dropzone.classList.contains('drag-active')).toBe(true);

    // Trigger dragleave
    dropzone.dispatchEvent(new CustomEvent('dragleave'));
    fixture.detectChanges();
    expect(dropzone.classList.contains('drag-active')).toBe(false);
  });

  // TEST CASE 1 (Option B): Drag Multiple Files - Strict Reject
  it('should reject multiple dropped files and emit invalidFile event', () => {
    let emittedError: string | undefined = undefined;
    component.removeFile.subscribe(() => {
      expect.unreachable('Should not emit removeFile');
    });
    component.fileChange.subscribe(() => {
      expect.unreachable('Should not emit fileChange');
    });
    component.invalidFile.subscribe((err) => {
      emittedError = err;
    });

    const dropzone = fixture.debugElement.query(By.css('.dropzone')).nativeElement as HTMLElement;

    // Mock dropping multiple files
    const file1 = new File(['image1'], 'image1.png', { type: 'image/png' });
    const file2 = new File(['image2'], 'image2.png', { type: 'image/png' });
    const filesList = [file1, file2];

    const dataTransfer = {
      files: {
        length: 2,
        item: (index: number) => filesList[index],
        0: file1,
        1: file2,
      } as unknown as FileList,
    };

    const dropEvent = new CustomEvent('drop') as unknown as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: true,
    });

    dropzone.dispatchEvent(dropEvent);
    fixture.detectChanges();

    expect(emittedError).toBe('Please upload only a single image file.');
  });

  // TEST CASE 2: Drag & Drop - Invalid File Type
  it('should reject single dropped file of invalid type and emit invalidFile event', () => {
    let emittedError: string | undefined = undefined;
    component.fileChange.subscribe(() => {
      expect.unreachable('Should not emit fileChange');
    });
    component.invalidFile.subscribe((err) => {
      emittedError = err;
    });

    const dropzone = fixture.debugElement.query(By.css('.dropzone')).nativeElement as HTMLElement;

    const invalidFile = new File(['document'], 'doc.pdf', { type: 'application/pdf' });
    const dataTransfer = {
      files: {
        length: 1,
        item: () => invalidFile,
        0: invalidFile,
      } as unknown as FileList,
    };

    const dropEvent = new CustomEvent('drop') as unknown as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: true,
    });

    dropzone.dispatchEvent(dropEvent);
    fixture.detectChanges();

    expect(emittedError).toBe('Invalid file type. Please select a JPG, JPEG, or PNG image.');
  });

  // TEST CASE 3: Drag & Drop - Valid Single File
  it('should accept a single dropped valid file and emit fileChange event', () => {
    let emittedFile: File | undefined = undefined;
    component.fileChange.subscribe((file) => {
      emittedFile = file;
    });
    component.invalidFile.subscribe(() => {
      expect.unreachable('Should not emit invalidFile');
    });

    const dropzone = fixture.debugElement.query(By.css('.dropzone')).nativeElement as HTMLElement;

    const validFile = new File(['image'], 'mars.png', { type: 'image/png' });
    const dataTransfer = {
      files: {
        length: 1,
        item: () => validFile,
        0: validFile,
      } as unknown as FileList,
    };

    const dropEvent = new CustomEvent('drop') as unknown as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: true,
    });

    dropzone.dispatchEvent(dropEvent);
    fixture.detectChanges();

    expect(emittedFile).toEqual(validFile);
    expect(dropzone.classList.contains('drag-active')).toBe(false);
  });

  // TEST CASE 5: Manual Selection - Invalid Type
  it('should reject manual selection of invalid file type and emit invalidFile event', () => {
    let emittedError: string | undefined = undefined;
    component.fileChange.subscribe(() => {
      expect.unreachable('Should not emit fileChange');
    });
    component.invalidFile.subscribe((err) => {
      emittedError = err;
    });

    const invalidFile = new File(['document'], 'doc.pdf', { type: 'application/pdf' });

    // Mock the file input element's files property
    const inputEl = component.fileInputElement();
    Object.defineProperty(inputEl, 'files', {
      value: [invalidFile],
      writable: true,
    });

    component.onFileChange();
    fixture.detectChanges();

    expect(emittedError).toBe('Invalid file type. Please select a JPG, JPEG, or PNG image.');
  });

  // TEST CASE 6: Manual Selection - Valid Type
  it('should accept manual selection of valid file type and emit fileChange event', () => {
    let emittedFile: File | undefined = undefined;
    component.fileChange.subscribe((file) => {
      emittedFile = file;
    });
    component.invalidFile.subscribe(() => {
      expect.unreachable('Should not emit invalidFile');
    });

    const validFile = new File(['image'], 'mars.png', { type: 'image/png' });

    const inputEl = component.fileInputElement();
    Object.defineProperty(inputEl, 'files', {
      value: [validFile],
      writable: true,
    });

    component.onFileChange();
    fixture.detectChanges();

    expect(emittedFile).toEqual(validFile);
  });
});
