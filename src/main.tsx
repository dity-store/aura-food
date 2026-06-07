import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent circular reference crash during sandbox logger intercepts
(() => {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  function sanitize(arg: any): any {
    if (arg === null || arg === undefined) return arg;
    if (typeof arg !== 'object') return arg;

    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        stack: arg.stack ? String(arg.stack).substring(0, 1000) : undefined
      };
    }

    if (
      arg instanceof Event || 
      (arg.constructor && (arg.constructor.name === 'Window' || arg.constructor.name.includes('Event'))) || 
      typeof arg.window === 'object' ||
      arg.target ||
      arg.currentTarget
    ) {
      return `[System ${arg.constructor ? arg.constructor.name : 'Object'}]`;
    }

    try {
      JSON.stringify(arg);
      return arg;
    } catch (e) {
      try {
        const copy: any = {};
        for (const key in arg) {
          if (Object.prototype.hasOwnProperty.call(arg, key)) {
            const val = arg[key];
            if (val && typeof val === 'object') {
              copy[key] = val.message || `[Object ${val.constructor ? val.constructor.name : ''}]`;
            } else {
              copy[key] = val;
            }
          }
        }
        return copy;
      } catch (innerEx) {
        return '[Non-serializable Object]';
      }
    }
  }

  console.error = function (...args: any[]) {
    originalError.apply(console, args.map(sanitize));
  };

  console.warn = function (...args: any[]) {
    originalWarn.apply(console, args.map(sanitize));
  };

  console.log = function (...args: any[]) {
    originalLog.apply(console, args.map(sanitize));
  };

  // Prevent uncaught errors or unhandled rejections containing Event or Window objects from propagation
  window.addEventListener('error', (event) => {
    event.preventDefault();
    event.stopPropagation();
    originalError.call(console, 'Uncaught error intercepted:', sanitize(event.error || event.message || event));
  }, { capture: true });

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    event.stopPropagation();
    originalError.call(console, 'Unhandled promise rejection intercepted:', sanitize(event.reason || event));
  }, { capture: true });
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
