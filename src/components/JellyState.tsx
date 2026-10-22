import welcome from "../assets/jelly/welcome.webp";
import searching from "../assets/jelly/searching.webp";
import thinking from "../assets/jelly/thinking.webp";
import sad from "../assets/jelly/sad.webp";

const expressions = { welcome, searching, thinking, sad };

/** Decorative, static feedback. The adjacent text always carries the meaning. */
export function JellyState({ expression, message, compact = false }: {
  expression: keyof typeof expressions;
  message?: string;
  compact?: boolean;
}) {
  return <div className={`jelly-state${compact ? " jelly-state-compact" : ""}`} data-jelly-state={expression}>
    <img src={expressions[expression]} alt="" aria-hidden="true" draggable={false} width={160} height={144} decoding="async" />
    {message ? <p>{message}</p> : null}
  </div>;
}
