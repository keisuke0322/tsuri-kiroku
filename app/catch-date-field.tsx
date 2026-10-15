'use client';

import { lazy, Suspense, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const CatchCalendar = lazy(() => import('./catch-calendar'));

export default function CatchDateField({
  value,
  onChange,
  error,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<Date | undefined>();

  function changeOpen(next: boolean) {
    if (next) setDraft(new Date(value + 'T12:00:00'));
    setOpen(next);
  }

  function confirm() {
    if (!draft) return;
    onChange(
      `${draft.getFullYear()}-${String(draft.getMonth() + 1).padStart(2, '0')}-${String(draft.getDate()).padStart(2, '0')}`,
    );
    setOpen(false);
  }

  return (
    <div
      className="catch-date-field"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onBlur?.();
      }}
    >
      <span id="catch-date-label" className="required-field-label">
        釣行日 ※
      </span>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <button
            data-cy="catch-date-trigger"
            type="button"
            className="catch-date-trigger"
            aria-required="true"
            aria-invalid={!!error}
            aria-describedby={error ? 'catch-error-date' : undefined}
            aria-labelledby="catch-date-label catch-date-value"
          >
            <span id="catch-date-value" data-cy="catch-date-value">
              {value.replaceAll('-', '/')}
            </span>
            <CalendarDays size={18} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="catch-date-popover"
          align="start"
          aria-label="釣行日を選択"
        >
          <Suspense fallback={<p role="status">カレンダーを読み込み中…</p>}>
            <CatchCalendar
              mode="single"
              selected={draft}
              onSelect={setDraft}
              defaultMonth={new Date(value + 'T12:00:00')}
              autoFocus
            />
          </Suspense>
          <div className="catch-date-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              data-cy="confirm-catch-date"
              type="button"
              disabled={!draft}
              onClick={confirm}
            >
              確定
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {error && (
        <span className="field-error" id="catch-error-date">
          {error}
        </span>
      )}
    </div>
  );
}
