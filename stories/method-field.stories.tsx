import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import MethodField from '@/app/method-field';

function Example(args: ComponentProps<typeof MethodField>) {
  const [, updateArgs] = useArgs();
  return (
    <div className="entry-form story-surface">
      <MethodField
        {...args}
        value={args.value}
        onChange={(next) => {
          updateArgs({ value: next });
          args.onChange(next);
        }}
      />
    </div>
  );
}

const meta = {
  id: 'method-field',
  title: '専用部品/釣り方入力',
  component: MethodField,
  args: { value: '', suggestions: ['ちょい投げ', '船釣り'], onChange: fn() },
  render: Example,
} satisfies Meta<typeof MethodField>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Filled: Story = { args: { value: 'サビキ' } };
export const NoCandidates: Story = { args: { value: '自由な釣り方' } };
export const Disabled: Story = { args: { inputProps: { disabled: true } } };
