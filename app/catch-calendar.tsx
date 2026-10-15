'use client';

import type { ComponentProps } from 'react';
import { ja } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';

export default function CatchCalendar(props: ComponentProps<typeof Calendar>) {
  return <Calendar locale={ja} {...props} />;
}
