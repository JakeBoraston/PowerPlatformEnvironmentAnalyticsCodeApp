/**
 * OData annotation helpers for Dataverse records.
 *
 * The Power Apps Code Apps SDK returns lookup display names as
 * OData annotations rather than mapped TypeScript fields, e.g.:
 *   `_publisherid_value@OData.Community.Display.V1.FormattedValue`
 *
 * These helpers extract those values safely.
 */

const FORMATTED_SUFFIX = '@OData.Community.Display.V1.FormattedValue';

/**
 * Get the formatted display value for a Dataverse lookup field.
 *
 * @example
 *   getFormattedValue(solution, '_publisherid_value')
 *   // → "The Digital Team"
 *
 *   getFormattedValue(solution, 'ismanaged')
 *   // → "Managed" or "Unmanaged"
 */
export function getFormattedValue(record: any, fieldName: string): string | null {
  if (!record) return null;

  // 1. Try the OData annotation key
  const annotationKey = `${fieldName}${FORMATTED_SUFFIX}`;
  if (record[annotationKey]) return record[annotationKey];

  // 2. Try the common TypeScript-friendly name mappings
  //    e.g. _publisherid_value → publisheridname
  const nameField = fieldName
    .replace(/^_/, '')
    .replace(/_value$/, '')
    + 'name';
  if (record[nameField]) return record[nameField];

  return null;
}

/**
 * Check if a Dataverse boolean/optionset field is truthy.
 * Handles both boolean `true` and numeric `1`.
 */
export function isTruthy(value: any): boolean {
  return value === true || value === 1 || value === '1';
}
