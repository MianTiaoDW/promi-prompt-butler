import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";

export function FavoriteButton({ active, onToggle, className = "" }: { active: boolean; onToggle: () => void; className?: string }) {
  const reduced = useReducedMotion();
  const controls = useAnimationControls();
  const previous = useRef(active);
  const sequence = useRef(0);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    if (reduced) return;
    if (active) {
      setBurst(++sequence.current);
      void controls.start({ scale: [1, .8, 1.38, .94, 1], rotate: [0, -10, 8, -3, 0], transition: { duration: .48 } });
    } else {
      setBurst(0);
      void controls.start({ scale: [1, .82, 1], rotate: 0, transition: { duration: .2 } });
    }
  }, [active, controls, reduced]);
  return <button type="button" onClick={onToggle} aria-pressed={active} title={active ? "取消收藏" : "收藏"} aria-label={active ? "取消收藏" : "收藏"} className={`promi-favorite-button ${active ? "is-favorite" : ""} ${className}`}>
    <motion.span className="promi-heart" animate={controls}><Heart className="h-4 w-4" fill={active ? "currentColor" : "none"} /></motion.span>
    <AnimatePresence>{burst && !reduced ? Array.from({ length: 6 }, (_, index) => {
      const angle = (index * 60 - 90) * Math.PI / 180;
      return <motion.span key={`${burst}-${index}`} className="promi-heart-spark" aria-hidden="true" initial={{ x: 0, y: 0, opacity: 0, scale: .4 }} animate={{ x: Math.cos(angle) * 21, y: Math.sin(angle) * 21, opacity: [0, 1, 0], scale: [.4, 1, 0] }} transition={{ duration: .5, ease: "easeOut" }} onAnimationComplete={index === 5 ? () => setBurst((current) => current === burst ? 0 : current) : undefined} />;
    }) : null}</AnimatePresence>
  </button>;
}
