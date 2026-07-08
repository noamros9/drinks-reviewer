import { useState } from 'react';

export function useScopeCategory(globalCategory) {
  const [override, setOverride] = useState(null);
  return [override ?? globalCategory, setOverride];
}
