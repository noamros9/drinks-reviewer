import { useState, useRef, useLayoutEffect } from 'react';

export function useDropdownAlign(open) {
  const [alignRight, setAlignRight] = useState(false);
  const menuRef = useRef(null);
  useLayoutEffect(() => {
    if (open && menuRef.current) {
      setAlignRight(menuRef.current.getBoundingClientRect().right > window.innerWidth);
    }
  }, [open]);
  return { alignRight, menuRef };
}
