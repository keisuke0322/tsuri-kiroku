import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const meta = {
  id: 'dropdown-menu',
  title: '共通部品/ドロップダウン',
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;
export default meta;
const onSelect = fn();
export const Default: StoryObj<typeof meta> = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">操作メニュー</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onSelect}>編集</DropdownMenuItem>
        <DropdownMenuItem disabled>準備中</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSelect}>
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
