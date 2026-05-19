export function hasAllRequestedIdsAuthorized(
  requestedIds: number[],
  authorizedIds: number[],
) {
  if (requestedIds.length === 0) return false;
  const authorizedSet = new Set(authorizedIds);
  return requestedIds.every((id) => authorizedSet.has(id));
}

