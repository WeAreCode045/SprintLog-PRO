import { useEffect, useState, useRef } from 'react';
import { Lightbulb } from 'lucide-react';
import { useLingui } from '@lingui/react/macro';

export interface BrandLightbulbProps {
  size: number;
  onClick?: () => void;
  title?: string;
  triggerGlow?: boolean | number | string;
}

/** The brand bulb: flicks on with a glowing ignite animation.
 * Click toggles or executes custom action (such as toggling the sidebar),
 * and triggers a glowing ignite/burst animation each time the state changes. */
export function BrandLightbulb({
  size,
  onClick,
  title,
  triggerGlow,
}: BrandLightbulbProps) {
  const { t } = useLingui();
  const [on, setOn] = useState(true);
  const [switchingOn, setSwitchingOn] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    setOn(true);
    setSwitchingOn(true);
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setOn(true);
    setSwitchingOn(false);
    const timer = setTimeout(() => {
      setAnimKey((prev) => prev + 1);
      setSwitchingOn(true);
    }, 20);
    return () => clearTimeout(timer);
  }, [triggerGlow]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setOn(true);
    setSwitchingOn(false);
    setTimeout(() => {
      setAnimKey((prev) => prev + 1);
      setSwitchingOn(true);
    }, 20);

    if (onClick) {
      onClick();
    }
  }

  return (
    <button
      key={animKey}
      type="button"
      className={`brand-lightbulb ${on ? 'brand-lightbulb--on' : ''} ${switchingOn ? 'brand-lightbulb--switching-on' : ''}`}
      onClick={handleClick}
      onAnimationEnd={() => setSwitchingOn(false)}
      title={title ?? (on ? t`Lamp uitzetten` : t`Lamp aanzetten`)}
      aria-pressed={on}
      aria-label={title ?? t`Lightbulb`}
    >
      <Lightbulb size={size} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
