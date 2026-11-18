import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

const meta = {
  id: 'popover',
  title: '共通部品/ポップオーバー',
  component: Popover,
} satisfies Meta<typeof Popover>;
export default meta;
export const Default: StoryObj<typeof meta> = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">補足を表示</Button>
      </PopoverTrigger>
      <PopoverContent aria-label="補足情報">
        操作に関連した補足情報を表示します。
      </PopoverContent>
    </Popover>
  ),
};
