'use client';

import { type ReactNode, useId } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

/**
 * The control vocabulary shared by the Inspector and every auto-generated formation form.
 * Each field is a labelled row with a readable value, so panels stay consistent and accessible.
 */

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  value?: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
  inline?: boolean;
}

export function FieldShell({ label, htmlFor, value, hint, children, className, inline = false }: FieldShellProps) {
  return (
    <div className={cn('flex min-w-0 gap-1.5', inline ? 'items-center justify-between' : 'flex-col', className)}>
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="truncate text-[0.8125rem] text-foreground/85">
          {label}
        </label>
        {value !== undefined && <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{value}</span>}
      </div>
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
}

const decimals = (step: number) => Math.max(0, Math.min(3, -Math.floor(Math.log10(step))));

export function SliderField({ label, value, min, max, step = 0.01, onChange, format, hint, disabled }: SliderFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} value={format ? format(value) : value.toFixed(decimals(step))} hint={hint}>
      <Slider
        id={id}
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        className="py-1.5"
      />
    </FieldShell>
  );
}

export function SwitchField({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} inline>
      <Switch id={id} checked={value} onCheckedChange={onChange} />
    </FieldShell>
  );
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

interface ChoiceProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  hint?: string;
}

export function SelectField<T extends string>({ label, value, options, onChange, hint }: ChoiceProps<T>) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

/** For 2–4 short options; wraps on narrow panels. */
export function SegmentedField<T extends string>({ label, value, options, onChange, hint }: ChoiceProps<T>) {
  return (
    <FieldShell label={label} hint={hint}>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        aria-label={label}
        className="flex w-full flex-wrap"
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className="min-w-0 flex-1 px-2 text-xs">
            <span className="truncate">{o.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldShell>
  );
}

export function TextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
  multiline?: boolean;
}) {
  const id = useId();
  const className =
    'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-cyan';
  return (
    <FieldShell label={label} htmlFor={id} value={maxLength ? `${value.length}/${maxLength}` : undefined}>
      {multiline ? (
        <textarea id={id} rows={2} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(className, 'resize-none')} />
      ) : (
        <input id={id} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </FieldShell>
  );
}

/** A swatch that opens react-colorful. */
export function ColorSwatch({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value}`}
          className="size-9 shrink-0 rounded-md border border-white/15 shadow-inner transition-transform duration-150 hover:scale-105"
          style={{ background: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto space-y-2 p-3" sideOffset={8}>
        <HexColorPicker color={value} onChange={onChange} />
        <HexColorInput
          color={value}
          onChange={onChange}
          prefixed
          aria-label={label}
          className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 font-mono text-xs uppercase outline-none focus-visible:border-cyan"
        />
      </PopoverContent>
    </Popover>
  );
}

/** Collapsible-free section: a mono eyebrow heading and a stack of fields. */
export function FieldGroup({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="eyebrow">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
