/**
 * Explicit test-only cast from an `unknown` object literal to a typed
 * collaborator (service, model instance, axios mock). Keeps specs free of
 * `any` while bypassing excessive structural checks on hand-built fakes.
 */
export function cast<T>(value: unknown): T {
  return value as T;
}
