import { FieldTree } from '@angular/forms/signals';

export interface FormFieldConfig {
  id: string;
  label: string;
  type: 'textarea' | 'text';
  field: FieldTree<string>;
  placeholder: string;
  groupClass: string;
}
