'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColorSwatch, FieldGroup, FieldShell, ResetButton, SegmentedField, SelectField, SliderField, SwitchField } from '@/components/controls/fields';
import { Button } from '@/components/ui/button';
import type { ResetScope } from '@/engine/commands/commands';
import { AXES, COLOR_MODES, FIREWORK_PALETTES, GROUNDS, SKY_PRESETS } from '@/engine/presets/schema';
import type { DroneLook, SceneSettings } from '@/engine/types';
import { formatNumber } from '@/lib/utils';
import { FLEET } from '@/engine/renderer/capabilities';
import { useFleetLimits, useStudio } from '@/store';
import { useShowActions } from './useShowActions';

/**
 * The show's settings, one section per area. The landing control deck and the studio
 * inspector both render these, so a control exists once and behaves the same everywhere.
 * Each section reads its slice of the store and writes through commands.
 */

type ScenePatch = Partial<Omit<SceneSettings, 'bloom' | 'physics' | 'fireworks'>> & {
  bloom?: Partial<SceneSettings['bloom']>;
  physics?: Partial<SceneSettings['physics']>;
  fireworks?: Partial<SceneSettings['fireworks']>;
};

/** Typed shortcuts for the settings commands, plus a reset button factory. */
export function useSettings() {
  const t = useTranslations('Settings');
  const { run } = useShowActions();
  return {
    t,
    run,
    setLook: (patch: Partial<DroneLook>) => run({ type: 'look.set', patch }),
    setScene: (patch: ScenePatch) => run({ type: 'scene.set', patch }),
    setFlight: (patch: Partial<ReturnType<typeof useStudio.getState>['show']['flight']>) => run({ type: 'flight.set', patch }),
    reset: (scope: ResetScope) => <ResetButton label={t('reset')} onClick={() => run({ type: 'settings.reset', scope })} />,
  };
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Colour mode and its stops. Used for the show's look and for one formation's override. */
export function ColorControls({ look, onChange }: { look: DroneLook; onChange: (patch: Partial<DroneLook>) => void }) {
  const t = useTranslations('Settings');
  const tOptions = useTranslations('Options');
  const stops = look.colorMode === 'solid' ? 1 : look.colors.length;
  return (
    <>
      <SelectField
        label={t('colorMode')}
        value={look.colorMode}
        options={COLOR_MODES.map((value) => ({ value, label: tOptions(`colorMode.${value}`) }))}
        onChange={(colorMode) => onChange({ colorMode, colors: colorMode !== 'solid' && look.colors.length < 2 ? [...look.colors, '#7cf7e4'] : look.colors })}
      />
      {['solid', 'gradient', 'palette'].includes(look.colorMode) && (
        <FieldShell label={t('colors')}>
          <div className="flex items-center gap-2">
            {look.colors.slice(0, stops).map((color, i) => (
              <ColorSwatch key={i} label={t('colorStop', { index: i + 1 })} value={color} onChange={(hex) => onChange({ colors: look.colors.map((c, j) => (j === i ? hex : c)) })} />
            ))}
            {look.colorMode !== 'solid' && (
              <>
                <Button variant="outline" size="icon-sm" aria-label={t('addColor')} disabled={look.colors.length >= 3} onClick={() => onChange({ colors: [...look.colors, '#ffffff'] })}>
                  <Plus />
                </Button>
                <Button variant="outline" size="icon-sm" aria-label={t('removeColor')} disabled={look.colors.length <= 2} onClick={() => onChange({ colors: look.colors.slice(0, -1) })}>
                  <Minus />
                </Button>
              </>
            )}
          </div>
        </FieldShell>
      )}
      {look.colorMode === 'gradient' && (
        <SegmentedField label={t('axis')} value={look.gradientAxis} options={AXES.map((value) => ({ value, label: value.toUpperCase() }))} onChange={(gradientAxis) => onChange({ gradientAxis })} />
      )}
    </>
  );
}

/** How many drones, and how each one looks. */
export function DroneSection() {
  const { t, run, setLook, reset } = useSettings();
  const look = useStudio((s) => s.show.look);
  const count = useStudio((s) => s.show.droneCount);
  const { min, max, clamp } = useFleetLimits();
  return (
    <FieldGroup title={t('fleet')} action={reset('look')}>
      <SliderField
        label={t('count')}
        value={clamp(count)}
        min={min}
        max={max}
        step={FLEET.step}
        format={formatNumber}
        hint={t('countHint', { min: formatNumber(min), max: formatNumber(max) })}
        onChange={(next) => run({ type: 'show.setDroneCount', count: next })}
      />
      <SliderField label={t('droneSize')} value={look.body} min={0.35} max={1} format={percent} onChange={(body) => setLook({ body })} />
      <SliderField label={t('ledSize')} value={look.size} min={0.08} max={0.8} onChange={(size) => setLook({ size })} />
      <SliderField label={t('glow')} value={look.glow} min={0} max={3} onChange={(glow) => setLook({ glow })} />
      <SliderField label={t('twinkle')} value={look.twinkle} min={0} max={1} onChange={(twinkle) => setLook({ twinkle })} />
      <SwitchField label={t('trails')} value={look.trails} onChange={(trails) => setLook({ trails })} />
    </FieldGroup>
  );
}

/** The show-wide colour scheme. */
export function ColorSection() {
  const { t, setLook } = useSettings();
  const look = useStudio((s) => s.show.look);
  return (
    <FieldGroup title={t('color')}>
      <ColorControls look={look} onChange={setLook} />
    </FieldGroup>
  );
}

/** Real-world limits: top speed and the gap drones must keep. */
export function FlightSection() {
  const { t, setFlight, reset } = useSettings();
  const flight = useStudio((s) => s.show.flight);
  return (
    <FieldGroup title={t('realism')} action={reset('flight')}>
      <SwitchField label={t('realistic')} hint={t('realisticHint')} value={flight.realistic} onChange={(realistic) => setFlight({ realistic })} />
      <SliderField label={t('maxSpeed')} value={flight.maxSpeed} min={3} max={25} step={0.5} disabled={!flight.realistic} format={(v) => `${v.toFixed(1)} m/s`} onChange={(maxSpeed) => setFlight({ maxSpeed })} />
      <SliderField label={t('separation')} value={flight.separation} min={0.5} max={4} step={0.1} disabled={!flight.realistic} format={(v) => `${v.toFixed(1)} m`} onChange={(separation) => setFlight({ separation })} />
    </FieldGroup>
  );
}

/** Sky, ground, stars and how bright the backdrop is. */
export function SkySection() {
  const { t, setScene, reset } = useSettings();
  const tOptions = useTranslations('Options');
  const scene = useStudio((s) => s.show.scene);
  return (
    <FieldGroup title={t('environment')} action={reset('scene')}>
      <SelectField label={t('sky')} value={scene.sky} options={SKY_PRESETS.map((value) => ({ value, label: tOptions(`sky.${value}`) }))} onChange={(sky) => setScene({ sky })} />
      <SegmentedField label={t('ground')} value={scene.ground} options={GROUNDS.map((value) => ({ value, label: tOptions(`ground.${value}`) }))} onChange={(ground) => setScene({ ground })} />
      <SliderField label={t('ambient')} value={scene.ambient} min={0} max={1} onChange={(ambient) => setScene({ ambient })} />
      <SliderField label={t('stars')} value={scene.stars} min={0} max={1} onChange={(stars) => setScene({ stars })} />
      <SliderField label={t('starSize')} value={scene.starSize} min={0} max={1} onChange={(starSize) => setScene({ starSize })} />
      <SliderField label={t('fog')} value={scene.fog} min={0} max={1} onChange={(fog) => setScene({ fog })} />
    </FieldGroup>
  );
}

export function FireworksSection() {
  const { t, setScene, reset } = useSettings();
  const tOptions = useTranslations('Options');
  const fireworks = useStudio((s) => s.show.scene.fireworks);
  const off = fireworks.intensity === 0;
  return (
    <FieldGroup title={t('fireworks')} action={reset('fireworks')}>
      <SliderField label={t('fireworksIntensity')} value={fireworks.intensity} min={0} max={1} format={(v) => (v === 0 ? t('off') : percent(v))} onChange={(intensity) => setScene({ fireworks: { intensity } })} />
      <SliderField label={t('fireworksSize')} value={fireworks.size} min={0.5} max={2} disabled={off} onChange={(size) => setScene({ fireworks: { size } })} />
      <SegmentedField
        label={t('fireworksColors')}
        value={fireworks.palette}
        options={FIREWORK_PALETTES.map((value) => ({ value, label: tOptions(`fireworks.${value}`) }))}
        onChange={(palette) => setScene({ fireworks: { palette } })}
      />
    </FieldGroup>
  );
}
