import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

const meta = {
  id: 'collapsible',
  title: '共通部品/折りたたみ',
  component: Collapsible,
} satisfies Meta<typeof Collapsible>;
export default meta;
export const Default: StoryObj<typeof meta> = {
  render: () => (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline">詳細を表示・非表示</Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        追加の道具情報を表示する領域です。
      </CollapsibleContent>
    </Collapsible>
  ),
};
