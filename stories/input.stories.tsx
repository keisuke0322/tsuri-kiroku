import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '@/components/ui/input';

const meta = {
  id: 'input',
  title: '共通部品/入力欄',
  component: Input,
  args: { 'aria-label': 'メモ', placeholder: '釣行のメモを入力' },
} satisfies Meta<typeof Input>;
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
    <div className="entry-form story-surface">
      <Input {...args} />
      <span id="input-error" className="field-error">
        入力内容を確認してください。
      </span>
    </div>
  ),
};
