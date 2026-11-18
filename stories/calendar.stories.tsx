import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ja } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';

function CalendarExample() {
  const [selected, setSelected] = useState<Date | undefined>(
    new Date(2026, 10, 18),
  );
  return (
    <Calendar
      mode="single"
      locale={ja}
      defaultMonth={new Date(2026, 10, 1)}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

const meta = {
  id: 'calendar',
  title: '共通部品/カレンダー',
  component: CalendarExample,
} satisfies Meta<typeof CalendarExample>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
