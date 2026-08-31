import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion } from 'motion/react';
import App from './App.tsx';
import './index.css';

/** Loaded on demand — see the note in `lib/motionFeatures.ts`. */
const loadMotionFeatures = () => import('./lib/motionFeatures').then(mod => mod.default);

/**
 * `LazyMotion` plus `m` components everywhere (never `motion`) keeps the animation
 * runtime out of the critical bundle. `strict` turns a stray `motion.div` into a loud
 * runtime error rather than a silent size regression.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <App />
    </LazyMotion>
  </StrictMode>,
);
