'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColorSwatch, FieldGroup, FieldShell, SegmentedField, SelectField, SliderField, SwitchField, TextField } from '@/components/controls/fields';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AXES, CAMERA_PRESETS, COLOR_MODES, EASE_CURVES, EFFECTS, GROUNDS, ORDERS, SIM_CURVES, SKY_PRESETS } from '@/engine/presets/schema';
import type { DroneLook, Keyframe, SceneSettings } from '@/engine/types';
import { useShowActions } from '@/components/show/useShowActions';
import { mutate, useStudio } from '@/store';
import type { InspectorTab } from '@/store/slices/ui';

const TABS: InspectorTab[] = ['drones', 'motion', 'scene', 'camera', 'fx'];
const INHERIT = '__inherit';

/** Colour mode + its stops; used for the show look and for a keyframe's override. */
function ColorControls({ look, onChange }: { look: DroneLook; onChange: (patch: Partial<DroneLook>) => void }) {
  const t = useTranslations('Studio.inspector');
  const tOptions = useTranslations('Options');
  const stops = look.colorMode === 'solid' ? 1 : look.colors.length;
  const usesStops = ['solid', 'gradient', 'palette'].includes(look.colorMode);
  return (
    <>
      <SelectField
        label={t('colorMode')}
        value={look.colorMode}
        options={COLOR_MODES.map((value) => ({ value, label: tOptions(`colorMode.${value}`) }))}
        onChange={(colorMode) => onChange({ colorMode, colors: colorMode !== 'solid' && look.colors.length < 2 ? [...look.colors, '#7cf7e4'] : look.colors })}
      />
      {usesStops && (
        <FieldShell label={t('colors')}>
          <div className="flex items-center gap-2">
            {look.colors.slice(0, stops).map((color, i) => (
              <ColorSwatch
                key={i}
                label={t('colorStop', { index: i + 1 })}
                value={color}
                onChange={(hex) => onChange({ colors: look.colors.map((c, j) => (j === i ? hex : c)) })}
              />
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
        <SegmentedField
          label={t('axis')}
          value={look.gradientAxis}
          options={AXES.map((value) => ({ value, label: value.toUpperCase() }))}
          onChange={(gradientAxis) => onChange({ gradientAxis })}
        />
      )}
    </>
  );
}

/** Right rail: everything about how the show looks and moves. Every change is a command. */
export function Inspector() {
  const t = useTranslations('Studio.inspector');
  const tOptions = useTranslations('Options');
  const { run } = useShowActions();
  const show = useStudio((s) => s.show);
  const tab = useStudio((s) => s.ui.inspectorTab);
  const pushToy = useStudio((s) => s.ui.pushToy);
  const maxDrones = useStudio((s) => s.runtime.capabilities?.tier.maxDrones ?? 20000);
  const keyframe = useStudio((s) => s.show.keyframes.find((k) => k.id === s.selectedKeyframeId));

  const { look, scene, flight } = show;
  const setLook = (patch: Partial<DroneLook>) => run({ type: 'look.set', patch });
  const setScene = (patch: Partial<Omit<SceneSettings, 'bloom' | 'physics'>> & { bloom?: Partial<SceneSettings['bloom']>; physics?: Partial<SceneSettings['physics']> }) =>
    run({ type: 'scene.set', patch });
  const setKeyframe = (patch: Partial<Omit<Keyframe, 'transition'>> & { transition?: Partial<Keyframe['transition']> }) =>
    keyframe && run({ type: 'keyframe.update', id: keyframe.id, patch });
  const curve = keyframe?.transition.curve ?? 'power3.inOut';

  return (
    <Tabs value={tab} onValueChange={(value) => mutate((s) => void (s.ui.inspectorTab = value as InspectorTab))} className="flex h-full min-h-0 flex-col gap-0">
      <TabsList className="mx-3 mt-3 grid h-9 shrink-0 grid-cols-5">
        {TABS.map((value) => (
          <TabsTrigger key={value} value={value} className="px-1 text-xs">
            {t(`tabs.${value}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="drones" className="space-y-6">
          <FieldGroup title={t('fleet')}>
            <SliderField
              label={t('count')}
              value={Math.min(show.droneCount, maxDrones)}
              min={100}
              max={maxDrones}
              step={100}
              format={(v) => v.toLocaleString()}
              hint={t('countHint', { max: maxDrones })}
              onChange={(count) => run({ type: 'show.setDroneCount', count })}
            />
            <SliderField label={t('size')} value={look.size} min={0.08} max={0.8} onChange={(size) => setLook({ size })} />
            <SliderField label={t('glow')} value={look.glow} min={0} max={3} onChange={(glow) => setLook({ glow })} />
            <SliderField label={t('twinkle')} value={look.twinkle} min={0} max={1} onChange={(twinkle) => setLook({ twinkle })} />
            <SwitchField label={t('trails')} value={look.trails} onChange={(trails) => setLook({ trails })} />
          </FieldGroup>
          <FieldGroup title={t('color')}>
            <ColorControls look={look} onChange={setLook} />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="motion" className="space-y-6">
          {keyframe ? (
            <FieldGroup title={t('transitionInto', { name: keyframe.name })}>
              <TextField label={t('name')} value={keyframe.name} maxLength={40} onChange={(name) => name.trim() && setKeyframe({ name })} />
              <SelectField
                label={t('curve')}
                value={curve}
                options={[...SIM_CURVES, ...EASE_CURVES].map((value) => ({ value, label: tOptions(`curve.${value}`) }))}
                onChange={(next) => setKeyframe({ transition: { curve: next, effect: next === 'physics' ? (keyframe.transition.effect ?? 'drop') : undefined } })}
              />
              {curve === 'physics' && (
                <SegmentedField
                  label={t('effect')}
                  value={keyframe.transition.effect ?? 'drop'}
                  options={EFFECTS.map((value) => ({ value, label: tOptions(`effect.${value}`) }))}
                  onChange={(effect) => setKeyframe({ transition: { effect } })}
                />
              )}
              <SliderField
                label={t('duration')}
                value={keyframe.transition.duration}
                min={0.2}
                max={20}
                step={0.1}
                format={(v) => `${v.toFixed(1)} s`}
                hint={flight.realistic ? t('durationHint') : undefined}
                onChange={(duration) => setKeyframe({ transition: { duration } })}
              />
              <SliderField label={t('hold')} value={keyframe.hold} min={0} max={30} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(hold) => setKeyframe({ hold })} />
              <SliderField label={t('stagger')} value={keyframe.transition.stagger} min={0} max={1} onChange={(stagger) => setKeyframe({ transition: { stagger } })} />
              <SelectField
                label={t('order')}
                value={keyframe.transition.order}
                options={ORDERS.map((value) => ({ value, label: tOptions(`order.${value}`) }))}
                onChange={(order) => setKeyframe({ transition: { order } })}
              />
              <SliderField label={t('spin')} value={keyframe.spin} min={-60} max={60} step={1} format={(v) => `${v.toFixed(0)}°/s`} onChange={(spin) => setKeyframe({ spin })} />
              <SwitchField
                label={t('ownColors')}
                hint={t('ownColorsHint')}
                value={!!keyframe.look}
                onChange={(on) => setKeyframe({ look: on ? { colorMode: look.colorMode, colors: look.colors, gradientAxis: look.gradientAxis } : null } as never)}
              />
              {keyframe.look && <ColorControls look={{ ...look, ...keyframe.look }} onChange={(patch) => setKeyframe({ look: patch })} />}
            </FieldGroup>
          ) : (
            <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted-foreground">{t('selectKeyframe')}</p>
          )}
          <FieldGroup title={t('realism')}>
            <SwitchField label={t('realistic')} hint={t('realisticHint')} value={flight.realistic} onChange={(realistic) => run({ type: 'flight.set', patch: { realistic } })} />
            <SliderField label={t('maxSpeed')} value={flight.maxSpeed} min={3} max={25} step={0.5} disabled={!flight.realistic} format={(v) => `${v.toFixed(1)} m/s`} onChange={(maxSpeed) => run({ type: 'flight.set', patch: { maxSpeed } })} />
            <SliderField label={t('separation')} value={flight.separation} min={0.5} max={4} step={0.1} disabled={!flight.realistic} format={(v) => `${v.toFixed(1)} m`} onChange={(separation) => run({ type: 'flight.set', patch: { separation } })} />
          </FieldGroup>
          <FieldGroup title={t('feel')}>
            <SliderField label={t('swarm')} value={look.swarm} min={0} max={1} onChange={(swarm) => setLook({ swarm })} />
            <SliderField label={t('hoverBob')} value={look.hoverBob} min={0} max={1} onChange={(hoverBob) => setLook({ hoverBob })} />
          </FieldGroup>
          <FieldGroup title={t('physics')}>
            <SliderField label={t('gravity')} value={scene.physics.gravity} min={1} max={30} step={0.1} format={(v) => `${v.toFixed(1)} m/s²`} onChange={(gravity) => setScene({ physics: { gravity } })} />
            <SliderField label={t('restitution')} value={scene.physics.restitution} min={0} max={1} onChange={(restitution) => setScene({ physics: { restitution } })} />
            <SliderField label={t('windDirection')} value={scene.physics.windDirection} min={0} max={360} step={1} format={(v) => `${v.toFixed(0)}°`} onChange={(windDirection) => setScene({ physics: { windDirection } })} />
            <SliderField label={t('windStrength')} value={scene.physics.windStrength} min={0} max={20} step={0.1} onChange={(windStrength) => setScene({ physics: { windStrength } })} />
            <SliderField label={t('maxBodies')} value={scene.physics.maxBodies} min={100} max={3000} step={100} format={(v) => v.toLocaleString()} onChange={(maxBodies) => setScene({ physics: { maxBodies } })} />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="scene" className="space-y-6">
          <FieldGroup title={t('environment')}>
            <SelectField label={t('sky')} value={scene.sky} options={SKY_PRESETS.map((value) => ({ value, label: tOptions(`sky.${value}`) }))} onChange={(sky) => setScene({ sky })} />
            <SegmentedField label={t('ground')} value={scene.ground} options={GROUNDS.map((value) => ({ value, label: tOptions(`ground.${value}`) }))} onChange={(ground) => setScene({ ground })} />
            <SliderField label={t('stars')} value={scene.stars} min={0} max={1} onChange={(stars) => setScene({ stars })} />
            <SliderField label={t('fog')} value={scene.fog} min={0} max={1} onChange={(fog) => setScene({ fog })} />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="camera" className="space-y-6">
          <FieldGroup title={t('cameraShow')}>
            <SelectField label={t('cameraPreset')} value={scene.cameraPreset} options={CAMERA_PRESETS.map((value) => ({ value, label: tOptions(`camera.${value}`) }))} onChange={(cameraPreset) => setScene({ cameraPreset })} />
            <SliderField label={t('autoOrbit')} value={scene.autoOrbit} min={0} max={1} onChange={(autoOrbit) => setScene({ autoOrbit })} />
          </FieldGroup>
          {keyframe && (
            <FieldGroup title={t('cameraShot', { name: keyframe.name })}>
              <SelectField
                label={t('shot')}
                value={keyframe.camera?.preset ?? INHERIT}
                options={[{ value: INHERIT, label: t('inherit') }, ...CAMERA_PRESETS.map((value) => ({ value: value as string, label: tOptions(`camera.${value}`) }))]}
                onChange={(preset) => setKeyframe({ camera: preset === INHERIT ? undefined : { preset: preset as (typeof CAMERA_PRESETS)[number] } })}
              />
            </FieldGroup>
          )}
          <FieldGroup title={t('toys')}>
            <SwitchField label={t('pushToy')} hint={t('pushToyHint')} value={pushToy} onChange={(on) => mutate((s) => void (s.ui.pushToy = on))} />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="fx" className="space-y-6">
          <FieldGroup title={t('bloom')}>
            <SliderField label={t('strength')} value={scene.bloom.strength} min={0} max={3} onChange={(strength) => setScene({ bloom: { strength } })} />
            <SliderField label={t('radius')} value={scene.bloom.radius} min={0} max={1} onChange={(radius) => setScene({ bloom: { radius } })} />
            <SliderField label={t('threshold')} value={scene.bloom.threshold} min={0} max={1} onChange={(threshold) => setScene({ bloom: { threshold } })} />
          </FieldGroup>
          <FieldGroup title={t('film')}>
            <SliderField label={t('exposure')} value={scene.exposure} min={0.3} max={2.5} onChange={(exposure) => setScene({ exposure })} />
            <SliderField label={t('vignette')} value={scene.vignette} min={0} max={1} onChange={(vignette) => setScene({ vignette })} />
            <SliderField label={t('grain')} value={scene.grain} min={0} max={1} onChange={(grain) => setScene({ grain })} />
          </FieldGroup>
        </TabsContent>
      </div>
    </Tabs>
  );
}
