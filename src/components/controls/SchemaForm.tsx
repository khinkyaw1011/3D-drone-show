'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Controller, type Resolver, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { SegmentedField, SelectField, SliderField, SwitchField, TextField } from './fields';

type FieldSpec =
  | { kind: 'enum'; options: string[] }
  | { kind: 'number'; min: number; max: number; step: number }
  | { kind: 'boolean' }
  | { kind: 'string'; maxLength?: number };

interface ZodInternals {
  def: { type: string; innerType?: ZodInternals };
  options?: string[];
  minValue?: number | null;
  maxValue?: number | null;
  maxLength?: number | null;
  format?: string | null;
}

/** Peel default/optional wrappers and read just enough of a zod schema to pick a control. */
function fieldSpec(schema: unknown): FieldSpec | null {
  let s = schema as ZodInternals;
  while (s.def.innerType && ['default', 'prefault', 'optional', 'nullable'].includes(s.def.type)) s = s.def.innerType;
  switch (s.def.type) {
    case 'enum':
      return { kind: 'enum', options: s.options ?? [] };
    case 'boolean':
      return { kind: 'boolean' };
    case 'string':
      return { kind: 'string', maxLength: s.maxLength ?? undefined };
    case 'number': {
      const min = s.minValue ?? 0;
      const max = s.maxValue ?? 1;
      const integer = s.format === 'safeint' || s.format === 'int32';
      return { kind: 'number', min, max, step: integer ? 1 : max - min > 20 ? 1 : 0.01 };
    }
    default:
      return null;
  }
}

interface SchemaFormProps<T extends Record<string, unknown>> {
  schema: z.ZodObject;
  value: T;
  onChange: (value: T) => void;
  /** Keys handled by custom UI (uploads, baked data) and left out of the generated form. */
  hidden?: string[];
}

/**
 * A settings form generated from a zod object schema (react-hook-form + zod resolver).
 * New formation sources get their UI for free: labels come from `Fields.<key>` messages,
 * enum options from `Options.<key>.<value>`, falling back to the raw names.
 */
export function SchemaForm<T extends Record<string, unknown>>({ schema, value, onChange, hidden = [] }: SchemaFormProps<T>) {
  const t = useTranslations();
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema) as unknown as Resolver<Record<string, unknown>>,
    values: value,
    mode: 'onChange',
  });
  const latest = useRef({ onChange, sent: JSON.stringify(value) });
  useEffect(() => {
    latest.current.onChange = onChange;
    latest.current.sent = JSON.stringify(value);
  });

  useEffect(() => {
    const subscription = form.watch((values) => {
      const parsed = schema.safeParse(values);
      if (!parsed.success) return;
      const json = JSON.stringify(parsed.data);
      // Skip echoes of our own / external updates so store <-> form never loops.
      if (json === latest.current.sent) return;
      latest.current.sent = json;
      latest.current.onChange(parsed.data as T);
    });
    return () => subscription.unsubscribe();
  }, [form, schema]);

  const label = (key: string) => (t.has(`Fields.${key}`) ? t(`Fields.${key}`) : key);
  const optionLabel = (key: string, option: string) => (t.has(`Options.${key}.${option}`) ? t(`Options.${key}.${option}`) : option);

  return (
    <form className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
      {Object.entries(schema.shape)
        .filter(([key]) => !hidden.includes(key))
        .map(([key, fieldSchema]) => {
          const spec = fieldSpec(fieldSchema);
          if (!spec) return null;
          return (
            <Controller
              key={key}
              name={key}
              control={form.control}
              render={({ field }) => {
                if (spec.kind === 'number')
                  return <SliderField label={label(key)} value={Number(field.value ?? spec.min)} min={spec.min} max={spec.max} step={spec.step} onChange={field.onChange} />;
                if (spec.kind === 'boolean') return <SwitchField label={label(key)} value={!!field.value} onChange={field.onChange} />;
                if (spec.kind === 'string')
                  return <TextField label={label(key)} value={String(field.value ?? '')} maxLength={spec.maxLength} onChange={field.onChange} />;
                const options = spec.options.map((o) => ({ value: o, label: optionLabel(key, o) }));
                const Choice = options.length <= 4 ? SegmentedField : SelectField;
                return <Choice label={label(key)} value={String(field.value ?? options[0]?.value)} options={options} onChange={field.onChange} />;
              }}
            />
          );
        })}
    </form>
  );
}
