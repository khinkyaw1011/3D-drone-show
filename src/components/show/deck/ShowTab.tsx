'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SelectField, SliderField } from '@/components/controls/fields';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import { CAMERA_PRESETS } from '@/engine/presets/schema';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store';
import { ModelAnimation } from '../FileTools';
import { VIEW_ICONS } from '../icons';
import { useShowActions } from '../useShowActions';
import { Chip, speedLabel } from './Chip';

/** The show's formations: tap one to fly to it. Formations the visitor added can be removed; the show's own stay. */
export function FormationChips() {
  const t = useTranslations('Quick');
  const { run } = useShowActions();
  const keyframes = useStudio((s) => s.show.keyframes);
  const index = useStudio((s) => s.playback.index);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('formations')}>
      {keyframes.map((kf, i) => (
        <span
          key={kf.id}
          className={cn(
            'flex shrink-0 items-center rounded-full border border-line bg-white/[0.04] text-[0.8125rem] transition-colors duration-150',
            i === index && 'border-glow/70 bg-glow/15',
          )}
        >
          <button
            type="button"
            aria-pressed={i === index}
            className={cn('rounded-l-full py-1.5 pl-3 text-paper/80 hover:text-paper', kf.custom ? 'pr-1.5' : 'rounded-r-full pr-3')}
            onClick={() => run({ type: 'playback.goTo', id: kf.id })}
          >
            {i + 1}. {kf.name}
          </button>
          {kf.custom && (
            <button
              type="button"
              aria-label={t('deleteFormation', { name: kf.name })}
              title={t('deleteFormation', { name: kf.name })}
              className="rounded-r-full py-1.5 pl-1 pr-2 text-muted-foreground hover:text-destructive"
              onClick={() => run({ type: 'keyframe.remove', id: kf.id })}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/** Where to watch from. */
export function ViewChips() {
  const t = useTranslations('Quick');
  const tOptions = useTranslations('Options');
  const { run } = useShowActions();
  const view = useStudio((s) => s.show.scene.cameraPreset);
  return (
    <div role="group" aria-label={t('view')}>
      <p className="mb-1.5 text-[0.8125rem] text-foreground/85">{t('view')}</p>
      <div className="flex flex-wrap gap-1.5">
        {CAMERA_PRESETS.map((preset) => {
          const Icon = VIEW_ICONS[preset];
          return (
            <Chip
              key={preset}
              active={view === preset}
              title={tOptions(`camera.${preset}`)}
              className="flex items-center gap-1.5"
              onClick={() => run({ type: 'scene.set', patch: { cameraPreset: preset } })}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {tOptions(`cameraShort.${preset}`)}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

/** Which show is loaded: the built-in ones and the visitor's saved presets. */
export function ShowPicker() {
  const t = useTranslations('Quick');
  const { run } = useShowActions();
  const name = useStudio((s) => s.show.name);
  const userPresets = useStudio((s) => s.userPresets);
  const presets = [...BUILTIN_SHOWS, ...userPresets];
  const loaded = presets.find((p) => p.name === name);
  return (
    <SelectField
      label={t('preset')}
      value={loaded?.id ?? '__custom'}
      options={[...(loaded ? [] : [{ value: '__custom', label: name }]), ...presets.map((p) => ({ value: p.id, label: p.name }))]}
      onChange={(presetId) => presetId !== '__custom' && run({ type: 'preset.apply', presetId })}
    />
  );
}

/** Playback speed, any value (the transport bar's button steps through the common ones). */
export function SpeedSlider() {
  const t = useTranslations('Quick');
  const { run } = useShowActions();
  const speed = useStudio((s) => s.playback.speed);
  return (
    <SliderField
      label={t('speed')}
      value={speed}
      min={0.25}
      max={8}
      step={0.25}
      format={(v) => (v === 1 ? t('realTime') : speedLabel(v))}
      onChange={(next) => run({ type: 'playback.setSpeed', speed: next })}
    />
  );
}

/** Deck tab: pick a show and a viewpoint, jump between formations. */
export function ShowTab() {
  const current = useStudio((s) => s.show.keyframes[s.playback.index]);
  return (
    <>
      <FormationChips />
      <ModelAnimation keyframe={current} />
      <ViewChips />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <ShowPicker />
        <SpeedSlider />
      </div>
    </>
  );
}
