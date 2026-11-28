import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from '@/components/ui/textarea';
import { appStyles } from '@/lib/app-styles';
import { cn } from '@/lib/utils';

const meta = {
  id: 'textarea',
  title: '共通部品/複数行入力',
  component: Textarea,
  args: { 'aria-label': 'メモ', placeholder: '釣行のメモを入力' },
} satisfies Meta<typeof Textarea>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Filled: Story = {
  args: { defaultValue: '海辺での釣行記録です。' },
};
export const Disabled: Story = { args: { disabled: true } };
export const Error: Story = {
  args: { 'aria-invalid': true, 'aria-describedby': 'input-error' },
  render: (args) => (
    <div className={cn(appStyles.entryForm, 'w-[min(100%,640px)] p-4')}>
      <Textarea {...args} />
      <span id="input-error" className={appStyles.fieldError}>
        入力内容を確認してください。
      </span>
    </div>
  ),
};
