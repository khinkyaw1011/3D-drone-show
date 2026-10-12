'use client';

import { useTranslations } from 'next-intl';
import { ColorSwatch, SliderField } from '@/components/controls/fields';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store';
import { ColorSection, DroneSection, EnvironmentPicker, FireworksSection, FlightSection, LightingField, SkySection, VenueSection } from '../settings';
import { useShowActions } from '../useShowActions';
import { Chip } from './Chip';

export const FLEET_COLORS = ['#ff5ca8', '#ff4d4d', '#ff9f43', '#ffd27a', '#5dff9b', '#7cf7e4', '#4d8dff', '#a46bff', '#ffffff'] as const;

/** One colour scheme for the whole fleet: the formations' own colours, rainbow, random, or a single colour. */
export function FleetColorPicker() {
  const t = useTranslations('Quick');
  const { setFleetColor } = useShowActions();
  const mode = useStudio((s) => s.show.look.colorMode);
  const first = useStudio((s) => s.show.look.colors[0]);
  const solid = mode === 'solid' ? first : null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('droneColor')}>
      <span className="mr-1 text-[0.8125rem] text-foreground/85">{t('droneColor')}</span>
      <Chip active={mode === 'formation'} onClick={() => setFleetColor('formation')}>
        {t('original')}
      </Chip>
      <Chip active={mode === 'rainbow'} onClick={() => setFleetColor('rainbow')}>
        {t('rainbow')}
      </Chip>
      <Chip active={mode === 'random'} onClick={() => setFleetColor('random')}>
        {t('random')}
      </Chip>
      {FLEET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={solid === color}
          onClick={() => setFleetColor('solid', color)}
          className={cn(
            'size-7 rounded-full border-2 border-white/25 transition-transform duration-150 hover:scale-110',
            solid === color && 'outline outline-2 outline-offset-2 outline-paper',
          )}
          style={{ background: color }}
        />
      ))}
      <ColorSwatch label={t('customColor')} value={solid ?? first} onChange={(color) => setFleetColor('solid', color)} />
    </div>
  );
}

/** Deck tab: how the drones and the night around them look. */
export function LookTab() {
  return (
    <>
      <LightingField />
      <EnvironmentPicker />
      <FleetColorPicker />
      <div className="space-y-2">
        <DroneSection fold defaultOpen lighting={false} />
        <ColorSection fold />
        <SkySection fold />
        <FireworksSection fold />
        <VenueSection fold />
      </div>
    </>
  );
}

/** Deck tab: real-world flight limits, and how fast the formation on stage turns. */
export function FlightTab() {
  const t = useTranslations('Quick');
  const { run } = useShowActions();
  const current = useStudio((s) => s.show.keyframes[s.playback.index]);
  return (
    <>
      <FlightSection />
      {current && (
        <SliderField
          label={t('spin')}
          value={current.spin}
          min={-60}
          max={60}
          step={1}
          format={(v) => `${v.toFixed(0)}°/s`}
          onChange={(spin) => run({ type: 'keyframe.update', id: current.id, patch: { spin } })}
        />
      )}
    </>
  );
}
