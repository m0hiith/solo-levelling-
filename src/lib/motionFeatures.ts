/**
 * The DOM animation feature bundle, in its own module so `LazyMotion` can pull it in
 * AFTER first paint. Without this indirection the features are a static import and
 * ship in the critical chunk, which is the thing LazyMotion exists to avoid.
 */
export { domAnimation as default } from 'motion/react';
