'use client';

import { ChevronDown, Clapperboard, ImageUp, Palette, Pause, Play, Repeat, Rocket, SkipBack, SkipForward, Sparkles, Wand2, Wind, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ColorSwatch, SelectField, SliderField } from '@/components/controls/fields';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SHAPES } from '@/engine/formations/sources/shape';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import { CAMERA_PRESETS } from '@/engine/presets/schema';
import { Link } from '@/i18n/navigation';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { IMAGE_ACCEPT } from '@/lib/image';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store';
import { FleetStats } from './FleetStats';
import { VIEW_ICONS } from './icons';
import { ColorSection, DroneSection, EnvironmentPicker, ScopeReset, FireworksSection, FlightSection, SkySection, VenueSection } from './settings';
import { useShowActions } from './useShowActions';

export const FLEET_COLORS = ['#ff5ca8', '#ff4d4d', '#ff9f43', '#ffd27a', '#5dff9b', '#7cf7e4', '#4d8dff', '#a46bff', '#ffffff'] as const;

const DECK_TABS = [
  { id: 'show', icon: Clapperboard },
  { id: 'create', icon: Wand2 },
  { id: 'look', icon: Palette },
  { id: 'flight', icon: Wind },
] as const;
type DeckTab = (typeof DECK_TABS)[number]['id'];

/** Pill button used for formations, shapes and presets. */
function Chip({ active, className, ...props }: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-[0.8125rem] text-paper/80 transition-colors duration-150 hover:text-paper',
        active && 'border-glow/70 bg-glow/15 text-paper',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The show's control deck: everything a visitor needs to make the show their own without
 * opening the studio. Every control is a command on the shared store.
 */
export function QuickControls({ className }: { className?: string }) {
  const t = useTranslations('Quick');
  const tOptions = useTranslations('Options');
  const { run, addFormation, addFromPrompt, addFromFile, setFleetColor } = useShowActions();
  const show = useStudio((s) => s.show);
  const playback = useStudio((s) => s.playback);
  const userPresets = useStudio((s) => s.userPresets);
  const isDesktop = useIsDesktop();
  // Open beside the show on wide screens; collapsed to the transport bar on phones so the sky stays visible.
  const [openChoice, setOpen] = useState<boolean | null>(null);
  const open = openChoice ?? isDesktop;
  const [tab, setTab] = useState<DeckTab>('show');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  const current = show.keyframes[playback.index];
  const progress = playback.duration > 0 ? playback.time / playback.duration : 0;
  const status = playback.playing ? 'playing' : playback.time > 0 ? 'paused' : 'standby';

  const { getRootProps, getInputProps, open: openFilePicker, isDragActive } = useDropzone({
    accept: { ...IMAGE_ACCEPT, 'model/gltf-binary': ['.glb'] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: async ([file]) => {
      setBusy(true);
      await addFromFile(file);
      setBusy(false);
    },
  });

  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    if (await addFromPrompt(prompt)) setPrompt('');
  };

  const presets = [...BUILTIN_SHOWS, ...userPresets];
  const fleetColor = show.look.colorMode === 'solid' ? show.look.colors[0] : null;

  return (
    <section
      {...getRootProps({ 'aria-label': t('label') })}
      className={cn('glass w-full outline-none', isDragActive && 'border-cyan ring-2 ring-cyan/40', className)}
    >
      <input {...getInputProps()} />
      <header className="flex items-center gap-3 px-3.5 pt-2.5 sm:px-4">
        <span className="flex items-center gap-2 rounded-full border border-line bg-black/25 px-2.5 py-1">
          <span
            className={cn(
              'size-2 rounded-full',
              status === 'playing' ? 'animate-pulse bg-emerald-300 shadow-[0_0_10px] shadow-emerald-300' : status === 'paused' ? 'bg-glow' : 'bg-muted-foreground',
            )}
          />
          <span className="eyebrow !text-paper/80">{t(`status.${status}`)}</span>
        </span>
        <p className="min-w-0 flex-1 truncate text-sm text-paper/85">
          {current ? t('formationOf', { index: playback.index + 1, total: show.keyframes.length, name: current.name }) : t('empty')}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-expanded={open}
          aria-label={open ? t('collapse') : t('expand')}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown className={cn('transition-transform duration-200', !open && 'rotate-180')} />
        </Button>
      </header>
      <FleetStats className="flex-wrap gap-x-4 gap-y-1 px-3.5 py-2 sm:px-4" />
      <div className="mx-3.5 h-[3px] overflow-hidden rounded-full bg-white/10 sm:mx-4" aria-hidden="true">
        <div className="h-full origin-left bg-gradient-to-r from-glow to-cyan" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* Transport stays reachable even when the deck is collapsed. */}
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 sm:px-4">
        <Button size="sm" className="rounded-full px-4" onClick={() => run({ type: 'playback.toggle' })}>
          {playback.playing ? <Pause /> : <Play />}
          {playback.playing ? t('pause') : t('play')}
        </Button>
        <Button variant="outline" size="icon-sm" aria-label={t('previous')} onClick={() => run({ type: 'playback.step', direction: -1 })}>
          <SkipBack />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label={t('next')} onClick={() => run({ type: 'playback.step', direction: 1 })}>
          <SkipForward />
        </Button>
        <Button variant="outline" size="sm" onClick={() => run({ type: 'playback.seek', t: 0 }, { type: 'playback.play' })}>
          <Rocket />
          {t('relaunch')}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t('loop')}
          aria-pressed={playback.loop}
          className={cn(playback.loop && 'border-cyan/60 text-cyan')}
          onClick={() => run({ type: 'playback.setLoop', loop: !playback.loop })}
        >
          <Repeat />
        </Button>
      </div>

      {open && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as DeckTab)} className="gap-0 border-t border-line">
          <TabsList className="mx-3.5 mt-3 grid !h-auto grid-cols-4 gap-1 bg-transparent p-0 sm:mx-4">
            {DECK_TABS.map(({ id, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="!h-auto flex-col gap-1 rounded-lg border border-transparent py-2 text-xs data-[state=active]:border-line data-[state=active]:bg-white/10 data-[state=active]:text-cyan"
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`tabs.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <p className="mx-3.5 mt-2.5 text-xs leading-snug text-muted-foreground sm:mx-4">{t(`about.${tab}`)}</p>

          <div className="scrollbar-thin max-h-[38svh] overflow-y-auto px-3.5 pb-4 pt-3.5 sm:px-4 lg:max-h-[calc(100svh-19rem)]">
            <TabsContent value="show" className="space-y-4">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('formations')}>
                {show.keyframes.map((kf, i) => (
                  <span
                    key={kf.id}
                    className={cn(
                      'flex shrink-0 items-center rounded-full border border-line bg-white/[0.04] text-[0.8125rem] transition-colors duration-150',
                      i === playback.index && 'border-glow/70 bg-glow/15',
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={i === playback.index}
                      className={cn('rounded-l-full py-1.5 pl-3 text-paper/80 hover:text-paper', kf.custom ? 'pr-1.5' : 'rounded-r-full pr-3')}
                      onClick={() => run({ type: 'playback.goTo', id: kf.id })}
                    >
                      {i + 1}. {kf.name}
                    </button>
                    {/* Only formations the visitor added can be removed here; the show's own stay. */}
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
              <div role="group" aria-label={t('view')}>
                <p className="mb-1.5 text-[0.8125rem] text-foreground/85">{t('view')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {CAMERA_PRESETS.map((preset) => {
                    const Icon = VIEW_ICONS[preset];
                    return (
                      <Chip
                        key={preset}
                        active={show.scene.cameraPreset === preset}
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <SelectField
                  label={t('preset')}
                  value={presets.some((p) => p.name === show.name) ? presets.find((p) => p.name === show.name)!.id : '__custom'}
                  options={[
                    ...(presets.some((p) => p.name === show.name) ? [] : [{ value: '__custom', label: show.name }]),
                    ...presets.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  onChange={(presetId) => presetId !== '__custom' && run({ type: 'preset.apply', presetId })}
                />
                <SliderField
                  label={t('speed')}
                  value={playback.speed}
                  min={0.25}
                  max={8}
                  step={0.25}
                  format={(v) => (v === 1 ? t('realTime') : `${v.toFixed(2)}×`)}
                  onChange={(speed) => run({ type: 'playback.setSpeed', speed })}
                />
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-paper">{t('typeIt')}</h3>
                <form onSubmit={submitPrompt} className="flex gap-2">
                  <label htmlFor="quick-prompt" className="sr-only">
                    {t('promptLabel')}
                  </label>
                  <input
                    id="quick-prompt"
                    value={prompt}
                    maxLength={40}
                    onChange={(e) => setPrompt(e.target.value)}
                    // Enter also confirms a Japanese (IME) conversion: do not submit mid-composition.
                    onKeyDown={(e) => e.key === 'Enter' && e.nativeEvent.isComposing && e.preventDefault()}
                    placeholder={t('promptPlaceholder')}
                    autoComplete="off"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-black/30 px-3.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-cyan"
                  />
                  <Button type="submit" className="h-10 rounded-lg px-4" disabled={!prompt.trim()}>
                    <Sparkles />
                    {t('create')}
                  </Button>
                </form>
                <p className="text-xs leading-snug text-muted-foreground">{t('typeHint')}</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-paper">{t('pickShape')}</h3>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('pickShape')}>
                  {SHAPES.map((shape) => (
                    <Chip key={shape} onClick={() => addFormation('shape', { shape })}>
                      {tOptions.has(`shape.${shape}`) ? tOptions(`shape.${shape}`) : shape}
                    </Chip>
                  ))}
                </div>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-paper">{t('uploadIt')}</h3>
                <button
                  type="button"
                  disabled={busy}
                  onClick={openFilePicker}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 px-4 py-4 text-sm text-paper transition-colors duration-150 hover:border-cyan/60 hover:bg-cyan/[0.05] disabled:opacity-60"
                >
                  <ImageUp className="size-4" />
                  {busy ? t('sampling') : t('uploadButton')}
                </button>
                <p className="text-xs leading-snug text-muted-foreground">{t('uploadHint')}</p>
              </section>
            </TabsContent>

            <TabsContent value="look" className="space-y-5">
              <EnvironmentPicker />
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('droneColor')}>
                <span className="mr-1 text-[0.8125rem] text-foreground/85">{t('droneColor')}</span>
                <Chip active={show.look.colorMode === 'formation'} onClick={() => setFleetColor('formation')}>
                  {t('original')}
                </Chip>
                <Chip active={show.look.colorMode === 'rainbow'} onClick={() => setFleetColor('rainbow')}>
                  {t('rainbow')}
                </Chip>
                <Chip active={show.look.colorMode === 'random'} onClick={() => setFleetColor('random')}>
                  {t('random')}
                </Chip>
                {FLEET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={fleetColor === color}
                    onClick={() => setFleetColor('solid', color)}
                    className={cn(
                      'size-7 rounded-full border-2 border-white/25 transition-transform duration-150 hover:scale-110',
                      fleetColor === color && 'outline outline-2 outline-offset-2 outline-paper',
                    )}
                    style={{ background: color }}
                  />
                ))}
                <ColorSwatch label={t('customColor')} value={fleetColor ?? show.look.colors[0]} onChange={(color) => setFleetColor('solid', color)} />
              </div>
              <div className="space-y-2">
                <DroneSection fold defaultOpen />
                <ColorSection fold />
                <SkySection fold />
                <FireworksSection fold />
                <VenueSection fold />
              </div>
            </TabsContent>

            <TabsContent value="flight" className="space-y-6">
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
            </TabsContent>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="text-xs text-muted-foreground">{t('autosaved')}</span>
              <ScopeReset scope="all" label={t('resetAll')} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('studioPitch')}{' '}
              <Link href="/studio" className="text-cyan underline-offset-4 hover:underline">
                {t('openStudio')}
              </Link>
            </p>
          </div>
        </Tabs>
      )}
    </section>
  );
}
