'use client';

import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, Pause, Play, Repeat, SkipBack, SkipForward, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FormationThumb } from '@/components/show/FormationThumb';
import { useShowActions } from '@/components/show/useShowActions';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatTimecode } from '@/engine/timeline/buildTimeline';
import type { DroneLook, Keyframe } from '@/engine/types';
import { cn } from '@/lib/utils';
import { useStudio } from '@/store';

interface CardProps {
  keyframe: Keyframe;
  index: number;
  look: DroneLook;
  selected: boolean;
  onStage: boolean;
}

function KeyframeCard({ keyframe, index, look, selected, onStage }: CardProps) {
  const t = useTranslations('Studio.timeline');
  const { run } = useShowActions();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: keyframe.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group relative flex w-36 shrink-0 flex-col gap-1.5 rounded-lg border bg-ink-2 p-1.5 sm:w-40',
        selected ? 'border-cyan/70' : 'border-line hover:border-white/20',
        isDragging && 'z-10 opacity-80 shadow-xl',
      )}
    >
      <button type="button" className="text-left" aria-pressed={selected} aria-label={t('select', { name: keyframe.name })} onClick={() => run({ type: 'playback.goTo', id: keyframe.id })}>
        <FormationThumb
          sourceId={keyframe.formation.sourceId}
          input={keyframe.formation.input}
          look={{ ...look, ...keyframe.look }}
          points={320}
          className="aspect-[16/9]"
        />
        <span className="mt-1.5 flex items-center gap-1.5 px-0.5">
          <span className={cn('size-1.5 shrink-0 rounded-full', onStage ? 'bg-glow shadow-[0_0_6px_var(--glow)]' : 'bg-white/20')} />
          <span className="truncate text-xs text-paper">
            {index + 1}. {keyframe.name}
          </span>
        </span>
        <span className="block px-0.5 font-mono text-[0.625rem] tabular-nums text-muted-foreground">
          {t('timing', { duration: keyframe.transition.duration.toFixed(1), hold: keyframe.hold.toFixed(1) })}
        </span>
      </button>
      <div className="absolute right-1.5 top-1.5 flex gap-0.5 rounded-md bg-ink/85 p-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <Button variant="ghost" size="icon-xs" aria-label={t('duplicate')} onClick={() => run({ type: 'keyframe.duplicate', id: keyframe.id })}>
          <Copy />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={t('delete')} onClick={() => run({ type: 'keyframe.remove', id: keyframe.id })}>
          <Trash2 />
        </Button>
        <button type="button" aria-label={t('reorder')} className="flex size-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-paper active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="size-3" />
        </button>
      </div>
    </li>
  );
}

/** Transport, scrubber and the sortable strip of formation cards. */
export function Timeline({ onAdd }: { onAdd?: () => void }) {
  const t = useTranslations('Studio.timeline');
  const { run } = useShowActions();
  const keyframes = useStudio((s) => s.show.keyframes);
  const look = useStudio((s) => s.show.look);
  const selectedId = useStudio((s) => s.selectedKeyframeId);
  const playback = useStudio((s) => s.playback);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = keyframes.findIndex((k) => k.id === active.id);
    const to = keyframes.findIndex((k) => k.id === over.id);
    if (from >= 0 && to >= 0) void run({ type: 'keyframe.move', from, to });
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-3">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" className="rounded-full" aria-label={playback.playing ? t('pause') : t('play')} onClick={() => run({ type: 'playback.toggle' })}>
          {playback.playing ? <Pause /> : <Play />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t('previous')} onClick={() => run({ type: 'playback.step', direction: -1 })}>
          <SkipBack />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t('next')} onClick={() => run({ type: 'playback.step', direction: 1 })}>
          <SkipForward />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('loop')}
          aria-pressed={playback.loop}
          className={cn(playback.loop && 'text-cyan')}
          onClick={() => run({ type: 'playback.setLoop', loop: !playback.loop })}
        >
          <Repeat />
        </Button>
        <Slider
          aria-label={t('scrub')}
          className="mx-1 min-w-0 flex-1"
          value={[Math.min(playback.time, playback.duration)]}
          min={0}
          max={Math.max(playback.duration, 0.01)}
          step={0.01}
          onValueChange={([time]) => run({ type: 'playback.seek', t: time })}
        />
        <span className="shrink-0 font-mono text-xs tabular-nums text-paper/80">
          {formatTimecode(playback.time)} <span className="text-muted-foreground">/ {formatTimecode(playback.duration)}</span>
        </span>
      </div>

      {keyframes.length === 0 ? (
        <button type="button" onClick={onAdd} className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted-foreground hover:border-white/25 hover:text-paper">
          {t('empty')}
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={keyframes.map((k) => k.id)} strategy={horizontalListSortingStrategy}>
            <ol className="scrollbar-thin flex min-h-0 flex-1 gap-2 overflow-x-auto pb-1" aria-label={t('label')}>
              {keyframes.map((keyframe, index) => (
                <KeyframeCard key={keyframe.id} keyframe={keyframe} index={index} look={look} selected={keyframe.id === selectedId} onStage={index === playback.index} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
