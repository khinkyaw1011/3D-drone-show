'use client';

import { type DroneLighting, LIGHTING_GLOW, bodyGlowOf } from '@/lib/site';
import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColorSwatch, FieldGroup, FieldShell, MultiToggleField, ResetButton, SegmentedField, SelectField, SliderField, SwitchField } from '@/components/controls/fields';
import { Button } from '@/components/ui/button';
import { type ResetScope, isScopeChanged } from '@/engine/presets/reset';
import { ENVIRONMENTS, environmentSwatch, matchEnvironment } from '@/engine/presets/environments';
import { AXES, COLOR_MODES, FIREWORK_PALETTES, FIREWORK_STYLES, GROUNDS, LANDMARKS, SKY_PRESETS, hasWater } from '@/engine/presets/schema';
import type { DroneLook, SceneSettings } from '@/engine/types';
import { cn, formatNumber } from '@/lib/utils';
import { FLEET } from '@/engine/renderer/capabilities';
import { useFleetLimits, useStudio } from '@/store';
import { GROUP_ICONS } from './icons';
import { useShowActions } from './useShowActions';

/**
 * The show's settings, one section per area. The landing control deck and the studio
 * inspector both render these, so a control exists once and behaves the same everywhere.
 * Each section reads its slice of the store and writes through commands.
 */

type ScenePatch = Partial<Omit<SceneSettings, 'bloom' | 'physics' | 'fireworks' | 'venue'>> & {
  venue?: Partial<SceneSettings['venue']>;
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
    /** A reset button for one feature. It only appears once that feature differs from its defaults. */
    reset: (scope: ResetScope) => <ScopeReset scope={scope} />,
  };
}

/** "Reset" for one feature, shown only while there is something to reset. */
export function ScopeReset({ scope, label }: { scope: ResetScope; label?: string }) {
  const t = useTranslations('Settings');
  const { run } = useShowActions();
  const changed = useStudio((s) => isScopeChanged(s.show, scope));
  if (!changed) return null;
  return <ResetButton label={label ?? t('reset')} onClick={() => run({ type: 'settings.reset', scope })} />;
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Sections fold on long panels (the landing deck) and stay open in the roomier inspector. */
interface SectionProps {
  fold?: boolean;
  defaultOpen?: boolean;
}

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

/** One-click environments. Each applies a scene patch through the normal `scene.set` command. */
export function EnvironmentPicker() {
  const { t, setScene } = useSettings();
  const tOptions = useTranslations('Options');
  const active = useStudio((s) => matchEnvironment(s.show.scene));
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-sm font-medium text-paper">{t('environmentPresets')}</h3>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t('environmentHint')}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.keys(ENVIRONMENTS).map((id) => {
          const swatch = environmentSwatch(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              onClick={() => setScene(ENVIRONMENTS[id])}
              className={cn(
                'group flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors duration-150',
                active === id ? 'border-glow/70 bg-glow/10' : 'border-line hover:border-white/25',
              )}
            >
              <span className="h-9 rounded-md" style={{ background: `linear-gradient(to top, ${swatch.horizon}, ${swatch.top} 75%)` }} />
              <span className="px-0.5 text-xs leading-tight text-paper/85 group-hover:text-paper">{tOptions(`environment.${id}`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** How many drones, and how each one looks. */
/**
 * How the airframes are lit: the whole drone glowing in its colour, or dark and lit by its own lamp.
 * Shows the visitor's choice, or the site default (from the environment) until they make one.
 */
export function LightingField() {
  const { t, setLook } = useSettings();
  const look = useStudio((s) => s.show.look);
  const value: DroneLighting = bodyGlowOf(look) < 0.5 ? 'realistic' : 'glow';
  return (
    <SegmentedField
      label={t('lighting')}
      hint={t('lightingHint')}
      value={value}
      options={[
        { value: 'glow', label: t('lightingGlow') },
        { value: 'realistic', label: t('lightingRealistic') },
      ]}
      onChange={(next) => setLook({ bodyGlow: LIGHTING_GLOW[next] })}
    />
  );
}

export function DroneSection({ lighting = true, ...group }: SectionProps & { lighting?: boolean }) {
  const { t, run, setLook, reset } = useSettings();
  const look = useStudio((s) => s.show.look);
  const count = useStudio((s) => s.show.droneCount);
  const { min, max, clamp } = useFleetLimits();
  return (
    <FieldGroup title={t('fleet')} description={t('about.fleet')} icon={GROUP_ICONS.fleet} action={reset('look')} {...group}>
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
      {lighting && <LightingField />}
      <SliderField label={t('bodyGlow')} hint={t('bodyGlowHint')} value={bodyGlowOf(look)} min={0} max={1} format={percent} onChange={(bodyGlow) => setLook({ bodyGlow })} />
      <SliderField label={t('twinkle')} value={look.twinkle} min={0} max={1} onChange={(twinkle) => setLook({ twinkle })} />
      <SwitchField label={t('trails')} value={look.trails} onChange={(trails) => setLook({ trails })} />
    </FieldGroup>
  );
}

/** The show-wide colour scheme. */
export function ColorSection(group: SectionProps) {
  const { t, setLook, reset } = useSettings();
  const look = useStudio((s) => s.show.look);
  return (
    <FieldGroup title={t('color')} description={t('about.color')} icon={GROUP_ICONS.color} action={reset('color')} {...group}>
      <ColorControls look={look} onChange={setLook} />
    </FieldGroup>
  );
}

/** Real-world limits: top speed and the gap drones must keep. */
export function FlightSection(group: SectionProps) {
  const { t, setFlight, reset } = useSettings();
  const flight = useStudio((s) => s.show.flight);
  return (
    <FieldGroup title={t('realism')} description={t('about.realism')} icon={GROUP_ICONS.realism} action={reset('flight')} {...group}>
      <SwitchField label={t('realistic')} hint={t('realisticHint')} value={flight.realistic} onChange={(realistic) => setFlight({ realistic })} />
      <SliderField label={t('maxSpeed')} value={flight.maxSpeed} min={3} max={25} step={0.5} disabled={!flight.realistic} format={(v) => `${v.toFixed(1)} m/s`} onChange={(maxSpeed) => setFlight({ maxSpeed })} />
      <SliderField label={t('separation')} value={flight.separation} min={0.5} max={4} step={0.1} disabled={!flight.realistic} format={(v) => `${v.toFixed(1)} m`} onChange={(separation) => setFlight({ separation })} />
    </FieldGroup>
  );
}

/** Why chosen landmarks are not showing, if they are not: no ground at all, or boats without water. */
export function landmarkHint(t: (key: 'landmarksNoGround' | 'landmarksNoWater') => string, ground: SceneSettings['ground'], landmarks: SceneSettings['landmarks']) {
  if (ground === 'none') return t('landmarksNoGround');
  if (landmarks.includes('boats') && !hasWater(ground)) return t('landmarksNoWater');
  return undefined;
}

/** Which landmarks stand around the site. In the sky settings and beside the camera views. */
export function LandmarksField() {
  const { t, setScene } = useSettings();
  const tOptions = useTranslations('Options');
  const landmarks = useStudio((s) => s.show.scene.landmarks);
  const ground = useStudio((s) => s.show.scene.ground);
  return (
    <MultiToggleField
      label={t('landmarks')}
      hint={landmarkHint(t, ground, landmarks)}
      value={landmarks}
      options={LANDMARKS.map((value) => ({ value, label: tOptions(`landmark.${value}`) }))}
      onChange={(next) => setScene({ landmarks: next })}
    />
  );
}

/** Sky, ground, stars and how bright the backdrop is. */
export function SkySection(group: SectionProps) {
  const { t, setScene, reset } = useSettings();
  const tOptions = useTranslations('Options');
  const scene = useStudio((s) => s.show.scene);
  return (
    <FieldGroup title={t('skyGroup')} description={t('about.sky')} icon={GROUP_ICONS.sky} action={reset('sky')} {...group}>
      <SelectField label={t('sky')} value={scene.sky} options={SKY_PRESETS.map((value) => ({ value, label: tOptions(`sky.${value}`) }))} onChange={(sky) => setScene({ sky })} />
      <SegmentedField label={t('ground')} value={scene.ground} options={GROUNDS.map((value) => ({ value, label: tOptions(`ground.${value}`) }))} onChange={(ground) => setScene({ ground })} />
      <LandmarksField />
      <SliderField label={t('ambient')} value={scene.ambient} min={0} max={1} onChange={(ambient) => setScene({ ambient })} />
      <SliderField label={t('stars')} value={scene.stars} min={0} max={1} onChange={(stars) => setScene({ stars })} />
      <SliderField label={t('starSize')} value={scene.starSize} min={0} max={1} onChange={(starSize) => setScene({ starSize })} />
      <SliderField label={t('starTwinkle')} value={scene.starTwinkle} min={0} max={1} onChange={(starTwinkle) => setScene({ starTwinkle })} />
      <SliderField label={t('milkyWay')} value={scene.milkyWay} min={0} max={1} onChange={(milkyWay) => setScene({ milkyWay })} />
      <SliderField label={t('fog')} value={scene.fog} min={0} max={1} onChange={(fog) => setScene({ fog })} />
      <SliderField label={t('wind')} value={scene.physics.windStrength} min={0} max={20} step={0.5} hint={t('windHint')} onChange={(windStrength) => setScene({ physics: { windStrength } })} />
      <SliderField label={t('windDirection')} value={scene.physics.windDirection} min={0} max={360} step={5} format={(v) => `${v.toFixed(0)}°`} onChange={(windDirection) => setScene({ physics: { windDirection } })} />
    </FieldGroup>
  );
}

export function FireworksSection(group: SectionProps) {
  const { t, setScene, reset } = useSettings();
  const tOptions = useTranslations('Options');
  const fireworks = useStudio((s) => s.show.scene.fireworks);
  const off = fireworks.intensity === 0;
  return (
    <FieldGroup title={t('fireworks')} description={t('about.fireworks')} icon={GROUP_ICONS.fireworks} action={reset('fireworks')} {...group}>
      <SliderField label={t('fireworksIntensity')} value={fireworks.intensity} min={0} max={1} format={(v) => (v === 0 ? t('off') : percent(v))} onChange={(intensity) => setScene({ fireworks: { intensity } })} />
      <SelectField
        label={t('fireworksStyle')}
        value={fireworks.style}
        options={FIREWORK_STYLES.map((value) => ({ value, label: tOptions(`fireworkStyle.${value}`) }))}
        onChange={(style) => setScene({ fireworks: { style } })}
      />
      <SliderField label={t('fireworksSize')} value={fireworks.size} min={0.5} max={2} disabled={off} onChange={(size) => setScene({ fireworks: { size } })} />
      <SliderField label={t('fireworksHeight')} value={fireworks.height} min={0.6} max={1.4} disabled={off} onChange={(height) => setScene({ fireworks: { height } })} />
      <SegmentedField
        label={t('fireworksColors')}
        value={fireworks.palette}
        options={FIREWORK_PALETTES.map((value) => ({ value, label: tOptions(`fireworks.${value}`) }))}
        onChange={(palette) => setScene({ fireworks: { palette } })}
      />
    </FieldGroup>
  );
}

/** Searchlights and the light the fleet throws on the ground. */
export function VenueSection(group: SectionProps) {
  const { t, setScene, reset } = useSettings();
  const venue = useStudio((s) => s.show.scene.venue);
  return (
    <FieldGroup title={t('venue')} description={t('about.venue')} icon={GROUP_ICONS.venue} action={reset('venue')} {...group}>
      <SliderField label={t('beams')} value={venue.beams} min={0} max={1} format={(v) => (v === 0 ? t('off') : percent(v))} onChange={(beams) => setScene({ venue: { beams } })} />
      <SliderField label={t('groundGlow')} value={venue.glow} min={0} max={1} format={(v) => (v === 0 ? t('off') : percent(v))} onChange={(glow) => setScene({ venue: { glow } })} />
    </FieldGroup>
  );
}
