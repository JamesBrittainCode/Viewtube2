type RelationValue<T> = T | T[] | null | undefined;

export function unwrapRelation<T>(value: RelationValue<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
