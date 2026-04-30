import { useEffect, useCallback, useRef } from 'react';

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent triggering if the user is explicitly typing into an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    const currentTime = Date.now();
    
    // Buffer threshold: hardware scanners typically "type" characters quickly.
    // Bluetooth scanners or apps might be slower, so we use 100ms.
    if (currentTime - lastKeyTime.current > 100) {
      buffer.current = '';
    }
    
    lastKeyTime.current = currentTime;

    // A barcode scanner typically finishes the input string with an "Enter" keystroke
    if (e.key === 'Enter') {
      if (buffer.current.length > 2) { 
        onScan(buffer.current);
      }
      buffer.current = ''; // Reset buffer after scan
    } else if (e.key.length === 1) { 
      // Only append printable characters
      buffer.current += e.key;
    }
  }, [onScan]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
