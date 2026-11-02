import { Icon } from 'pane-react/Icon';
import { ICON } from './icons.js';

/** A glyph from the shared set, sized by Pane's Icon (sm 16 / md 18). Decorative unless labelled. */
export function Glyph({ name, size = 'md', label, className }) {
  return (
    <Icon size={size} label={label} className={className}>
      <span className="lu-glyph" dangerouslySetInnerHTML={{ __html: ICON[name] || '' }} />
    </Icon>
  );
}
/** A raw glyph for places that size it themselves (inside IconButton, morphing buttons). */
export function RawGlyph({ name, className }) {
  return <span className={'lu-glyph ' + (className || '')} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON[name] || '' }} />;
}
