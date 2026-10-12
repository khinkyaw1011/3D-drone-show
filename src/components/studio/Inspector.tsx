'use client';

import { Camera, MoonStar, MousePointerClick, Shapes, Sparkles, Wand2, Wind } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { FieldGroup, SegmentedField, SelectField, SliderField, SwitchField, TextField } from '@/components/controls/fields';
import { SchemaForm } from '@/components/controls/SchemaForm';
import { FormationThumb } from '@/components/show/FormationThumb';
import { ColorControls, ColorSection, DroneSection, EnvironmentPicker, FireworksSection, FlightSection, ScopeReset, SkySection, VenueSection, useSettings } from '@/components/show/settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModelAnimation } from '@/components/show/FileTools';
import { getSource } from '@/engine/formations/registry';
import { CAMERA_PRESETS, EASE_CURVES, EFFECTS, MOTIONS, ORDERS, SIM_CURVES } from '@/engine/presets/schema';
import type { Keyframe } from '@/engine/types';
import { useStudio } from '@/store';
import { INSPECTOR_TABS, type InspectorTab } from '@/store/slices/ui';

const TAB_ICONS: Record<InspectorTab, typeof Shapes> = { formation: Shapes, drones: Sparkles, flight: Wind, scene: MoonStar, camera: Camera, fx: Wand2 };
const INHERIT = '__inherit';
/** Inputs owned by upload UI or baked data, never shown as form fields. */
const HIDDEN_FIELDS = ['src', 'name', 'svg', 'p', 'c', 'label', 'fileId', 'clips', 'clip', 'pose'];
/** GSAP ease names contain dots and brackets, which message keys may not. */
const messageKey = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '_');
const seconds = (v: number) => `${v.toFixed(1)} s`;

type KeyframePatch = Partial<Omit<Keyframe, 'transition' | 'look'>> & { transition?: Partial<Keyframe['transition']>; look?: Keyframe['look'] | null };

/** Everything about the selected formation: its shape, and how the fleet flies into it. */
function FormationTab() {
  const t = useTranslations('Studio.inspector');
  const tOptions = useTranslations('Options');
  const { run } = useSettings();
  const keyframe = useStudio((s) => s.show.keyframes.find((k) => k.id === s.selectedKeyframeId));
  const look = useStudio((s) => s.show.look);
  const realistic = useStudio((s) => s.show.flight.realistic);

  if (!keyframe)
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-4 py-10 text-center">
        <MousePointerClick className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-paper/80">{t('selectKeyframe')}</p>
      </div>
    );

  const source = getSource(keyframe.formation.sourceId);
  const set = (patch: KeyframePatch) => run({ type: 'keyframe.update', id: keyframe.id, patch });
  const curve = keyframe.transition.curve;

  return (
    <>
      <FieldGroup title={t('shapeGroup')}>
        <FormationThumb
          sourceId={keyframe.formation.sourceId}
          input={keyframe.formation.input}
          look={{ ...look, ...keyframe.look }}
          points={1400}
          debounceMs={140}
          label={keyframe.name}
          className="aspect-[16/10] border border-line"
        />
        <TextField label={t('name')} value={keyframe.name} maxLength={40} onChange={(name) => name.trim() && set({ name })} />
        <SchemaForm
          key={`${keyframe.id}:${source.id}`}
          schema={source.inputSchema as unknown as z.ZodObject}
          value={keyframe.formation.input as Record<string, unknown>}
          hidden={HIDDEN_FIELDS}
          onChange={(input) => run({ type: 'formation.update', id: keyframe.id, input })}
        />
        <ModelAnimation keyframe={keyframe} />
        <SliderField label={t('spin')} value={keyframe.spin} min={-60} max={60} step={1} format={(v) => `${v.toFixed(0)}°/s`} onChange={(spin) => set({ spin })} />
      </FieldGroup>

      <FieldGroup title={t('motionGroup')}>
        <SelectField
          label={t('motion')}
          value={keyframe.motion}
          options={MOTIONS.map((value) => ({ value, label: tOptions(`motion.${value}`) }))}
          onChange={(motion) => set({ motion })}
        />
        {keyframe.motion !== 'none' && (
          <SliderField label={t('motionAmount')} value={keyframe.motionAmount} min={0} max={1} onChange={(motionAmount) => set({ motionAmount })} />
        )}
      </FieldGroup>

      <FieldGroup title={t('flightGroup')}>
        <SelectField
          label={t('curve')}
          value={curve}
          options={[...EASE_CURVES, ...SIM_CURVES].map((value) => ({ value, label: tOptions(`curve.${messageKey(value)}`) }))}
          onChange={(next) => set({ transition: { curve: next, effect: next === 'physics' ? (keyframe.transition.effect ?? 'drop') : undefined } })}
        />
        {curve === 'physics' && (
          <SegmentedField
            label={t('effect')}
            value={keyframe.transition.effect ?? 'drop'}
            options={EFFECTS.map((value) => ({ value, label: tOptions(`effect.${value}`) }))}
            onChange={(effect) => set({ transition: { effect } })}
          />
        )}
        <SliderField
          label={t('duration')}
          value={keyframe.transition.duration}
          min={0.2}
          max={20}
          step={0.1}
          format={seconds}
          hint={realistic ? t('durationHint') : undefined}
          onChange={(duration) => set({ transition: { duration } })}
        />
        <SliderField label={t('hold')} value={keyframe.hold} min={0} max={30} step={0.1} format={seconds} onChange={(hold) => set({ hold })} />
        <SliderField label={t('stagger')} value={keyframe.transition.stagger} min={0} max={1} onChange={(stagger) => set({ transition: { stagger } })} />
        <SelectField
          label={t('order')}
          value={keyframe.transition.order}
          options={ORDERS.map((value) => ({ value, label: tOptions(`order.${value}`) }))}
          onChange={(order) => set({ transition: { order } })}
        />
      </FieldGroup>

      <FieldGroup title={t('colorGroup')}>
        <SwitchField
          label={t('ownColors')}
          hint={t('ownColorsHint')}
          value={!!keyframe.look}
          onChange={(on) => set({ look: on ? { colorMode: look.colorMode, colors: look.colors, gradientAxis: look.gradientAxis } : null })}
        />
        {keyframe.look && <ColorControls look={{ ...look, ...keyframe.look }} onChange={(patch) => set({ look: patch })} />}
      </FieldGroup>

      <FieldGroup title={t('cameraShot', { name: keyframe.name })}>
        <SelectField
          label={t('shot')}
          value={keyframe.camera?.preset ?? INHERIT}
          options={[{ value: INHERIT, label: t('inherit') }, ...CAMERA_PRESETS.map((value) => ({ value: value as string, label: tOptions(`camera.${value}`) }))]}
          onChange={(preset) => set({ camera: preset === INHERIT ? undefined : { preset: preset as (typeof CAMERA_PRESETS)[number] } })}
        />
      </FieldGroup>
    </>
  );
}

/** Right rail: the selected formation first, then everything show-wide. Every change is a command. */
export function Inspector() {
  const t = useTranslations('Studio.inspector');
  const tOptions = useTranslations('Options');
  const { run, setLook, setScene } = useSettings();
  const tab = useStudio((s) => s.ui.inspectorTab);
  const pushToy = useStudio((s) => s.ui.pushToy);
  const look = useStudio((s) => s.show.look);
  const scene = useStudio((s) => s.show.scene);

  return (
    <Tabs value={tab} onValueChange={(value) => run({ type: 'ui.set', patch: { inspectorTab: value } })} className="flex h-full min-h-0 flex-col gap-0">
      <TabsList className="mx-2 mt-2 grid !h-auto shrink-0 grid-cols-6 gap-0.5 bg-transparent p-0">
        {INSPECTOR_TABS.map((value) => {
          const Icon = TAB_ICONS[value];
          return (
            <TabsTrigger key={value} value={value} className="!h-auto min-w-0 flex-col gap-1 rounded-lg px-0.5 py-2 text-[0.625rem] leading-none data-[state=active]:bg-white/10 data-[state=active]:text-cyan">
              <Icon className="size-4" aria-hidden="true" />
              <span className="w-full truncate">{t(`tabs.${value}`)}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      <p className="mx-4 mt-2 border-t border-line pt-3 text-xs leading-snug text-muted-foreground">{t(`about.${tab}`)}</p>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="formation" className="space-y-6">
          <FormationTab />
        </TabsContent>

        <TabsContent value="drones" className="space-y-6">
          <DroneSection />
          <ColorSection />
        </TabsContent>

        <TabsContent value="flight" className="space-y-6">
          <FlightSection />
          <FieldGroup title={t('feel')}>
            <SliderField label={t('swarm')} value={look.swarm} min={0} max={1} onChange={(swarm) => setLook({ swarm })} />
            <SliderField label={t('hoverBob')} value={look.hoverBob} min={0} max={1} onChange={(hoverBob) => setLook({ hoverBob })} />
          </FieldGroup>
          <FieldGroup title={t('physics')} action={<ScopeReset scope="physics" />}>
            <SliderField label={t('gravity')} value={scene.physics.gravity} min={1} max={30} step={0.1} format={(v) => `${v.toFixed(1)} m/s²`} onChange={(gravity) => setScene({ physics: { gravity } })} />
            <SliderField label={t('restitution')} value={scene.physics.restitution} min={0} max={1} onChange={(restitution) => setScene({ physics: { restitution } })} />
            <SliderField label={t('windDirection')} value={scene.physics.windDirection} min={0} max={360} step={1} format={(v) => `${v.toFixed(0)}°`} onChange={(windDirection) => setScene({ physics: { windDirection } })} />
            <SliderField label={t('windStrength')} value={scene.physics.windStrength} min={0} max={20} step={0.1} onChange={(windStrength) => setScene({ physics: { windStrength } })} />
            <SliderField label={t('maxBodies')} value={scene.physics.maxBodies} min={100} max={3000} step={100} onChange={(maxBodies) => setScene({ physics: { maxBodies } })} />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="scene" className="space-y-6">
          <EnvironmentPicker />
          <SkySection />
          <FireworksSection />
          <VenueSection />
        </TabsContent>

        <TabsContent value="camera" className="space-y-6">
          <FieldGroup title={t('cameraShow')} action={<ScopeReset scope="camera" />}>
            <SelectField
              label={t('cameraPreset')}
              value={scene.cameraPreset}
              options={CAMERA_PRESETS.map((value) => ({ value, label: tOptions(`camera.${value}`) }))}
              onChange={(cameraPreset) => setScene({ cameraPreset })}
            />
            <SliderField label={t('autoOrbit')} value={scene.autoOrbit} min={0} max={1} onChange={(autoOrbit) => setScene({ autoOrbit })} />
          </FieldGroup>
          <FieldGroup title={t('toys')}>
            <SwitchField label={t('pushToy')} hint={t('pushToyHint')} value={pushToy} onChange={(on) => run({ type: 'ui.set', patch: { pushToy: on } })} />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="fx" className="space-y-6">
          <FieldGroup title={t('bloom')} action={<ScopeReset scope="fx" />}>
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
