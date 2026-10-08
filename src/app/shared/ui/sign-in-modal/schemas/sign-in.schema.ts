import { AuthCredentials } from '@/core/interfaces/auth-credentials.interface';
import { email, PathKind, required, SchemaOrSchemaFn } from '@angular/forms/signals';

export function signInSchemaValidation(): SchemaOrSchemaFn<AuthCredentials, PathKind.Root> {
  return (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' });
    email(schemaPath.email, { message: 'Invalid email format' });
    required(schemaPath.password, { message: 'Password is required' });
  };
}
