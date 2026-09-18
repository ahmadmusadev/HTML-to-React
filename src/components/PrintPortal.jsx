import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PrintPortal({ children }) {
  const [targetElement, setTargetElement] = useState(() => {
    if (typeof document === 'undefined') return null;
    return document.getElementById('print-portal-root');
  });

  useEffect(() => {
    let el = document.getElementById('print-portal-root');
    if (!el && typeof document !== 'undefined') {
      el = document.createElement('div');
      el.id = 'print-portal-root';
      document.body.appendChild(el);
    }
    setTargetElement(el);
  }, []);

  if (!targetElement) return null;
  return createPortal(children, targetElement);
}
