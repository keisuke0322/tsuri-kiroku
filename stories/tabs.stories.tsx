import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const meta = {
  id: 'tabs',
  title: '共通部品/タブ',
  component: Tabs,
  args: { defaultValue: '7', onValueChange: fn() },
} satisfies Meta<typeof Tabs>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="集計期間">
        <TabsTrigger value="7">7日間</TabsTrigger>
        <TabsTrigger value="30">30日間</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          準備中
        </TabsTrigger>
      </TabsList>
      <TabsContent value="7">過去7日間の釣果</TabsContent>
      <TabsContent value="30">過去30日間の釣果</TabsContent>
    </Tabs>
  ),
};
