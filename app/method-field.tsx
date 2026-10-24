'use client';

import { useId, useMemo, useRef, type ComponentProps } from 'react';
import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxTrigger,
} from '@/components/ui/combobox';

export default function MethodField({
  value,
  onChange,
  suggestions = [],
  label = '釣り方・仕掛け',
  dataCy = 'combination-method',
  inputProps,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  label?: string;
  dataCy?: string;
  inputProps?: ComponentProps<typeof ComboboxInput>;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const options = useMemo(
    () => [
      ...new Set(
        ['テンヤ', '浮き釣り', 'サビキ', 'ルアー', '投げ釣り', ...suggestions]
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ],
    [suggestions],
  );
  const { contains } = BaseCombobox.useFilter({ sensitivity: 'base' });
  // Reopening during the close animation can retain Base UI's previous query.
  // Filter from the controlled input so a single IME commit uses the new text.
  const filteredOptions = useMemo(
    () => options.filter((option) => contains(option, value.trim())),
    [options, contains, value],
  );

  return (
    <div className="method-field" data-method-field ref={container}>
      <label htmlFor={id}>{label}</label>
      <Combobox
        items={options}
        filteredItems={filteredOptions}
        value={value || null}
        inputValue={value}
        onInputValueChange={onChange}
        onValueChange={(next) => onChange(next || '')}
      >
        <ComboboxInput
          {...inputProps}
          id={id}
          aria-label={label}
          data-cy={dataCy}
          maxLength={200}
          placeholder="候補から選択、または自由入力（例：ちょい投げ、6号）"
          showTrigger={false}
        >
          <ComboboxTrigger
            className="method-trigger"
            aria-label={`${label}の候補を表示`}
            data-cy={`${dataCy}-trigger`}
          />
        </ComboboxInput>
        <ComboboxContent container={container} className="method-options">
          <ComboboxEmpty>
            候補はありません。そのまま入力できます。
          </ComboboxEmpty>
          <ComboboxList>
            {(option: string) => (
              <ComboboxItem key={option} value={option} data-cy="method-option">
                {option}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
