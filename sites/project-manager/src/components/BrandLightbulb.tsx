import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useLingui } from '@lingui/react/macro';

/** The brand bulb: stays dim/off until the page has fully finished loading (window `load`,
 * not just the initial script), then flicks on with a quick flicker and settles into a
 * gentle glow. Click toggles it on/off — same flicker plays each time it switches back on. */
export function BrandLightbulb({ size }: { size: number }) {
  const { t } = useLingui();
  const [on, setOn] = useState(false);
  const [switchingOn, setSwitchingOn] = useState(false);

  useEffect(() => {
    if (document.readyState === 'complete') {
      setOn(true);
      setSwitchingOn(true);
      return;
    }
    function handleLoad() {
      setOn(true);
      setSwitchingOn(true);
    }
    window.addEventListener('load', handleLoad);
    return () => window.removeEventListener('load', handleLoad);
  }, []);

  function toggle() {
    setOn((prev) => {
      const next = !prev;
      setSwitchingOn(next);
      return next;
    });
  }

  return (
    <button
      type="button"
      className={`brand-lightbulb ${on ? 'brand-lightbulb--on' : ''} ${switchingOn ? 'brand-lightbulb--switching-on' : ''}`}
      onClick={toggle}
      onAnimationEnd={() => setSwitchingOn(false)}
      title={on ? t`Lamp uitzetten` : t`Lamp aanzetten`}
      aria-pressed={on}
    >
      <Lightbulb size={size} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
