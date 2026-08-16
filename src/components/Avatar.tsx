import { fallbackColorFor, initialsFor } from '../lib/avatar';
import { cn } from '../lib/utils';

interface AvatarProps {
  avatar: string | null;
  displayName: string;
  className?: string;
}

/**
 * Renders the player's picture, falling back to tinted initials. The fallback is drawn
 * locally rather than fetched, so the HUD still renders an identity while offline.
 */
export function Avatar({ avatar, displayName, className }: AvatarProps) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={`${displayName}'s avatar`}
        className={cn('w-full h-full object-cover bg-surface', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'w-full h-full flex items-center justify-center bg-surface font-headline font-bold tracking-tighter',
        className,
      )}
      style={{ color: fallbackColorFor(displayName) }}
      aria-label={`${displayName}'s avatar`}
    >
      {initialsFor(displayName)}
    </div>
  );
}
