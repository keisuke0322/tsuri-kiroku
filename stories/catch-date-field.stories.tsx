import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import CatchDateField from '@/app/catch-date-field';
import { appStyles } from '@/lib/app-styles';
import { cn } from '@/lib/utils';

function Example(args: ComponentProps<typeof CatchDateField>) {
  const [, updateArgs] = useArgs();
  return (
    <div className={cn(appStyles.entryForm, 'w-[min(100%,640px)] p-4')}>
      <CatchDateField
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
  id: 'catch-date-field',
  title: '専用部品/釣行日入力',
  component: CatchDateField,
  args: { value: '2026-11-18', onChange: fn() },
  render: Example,
} satisfies Meta<typeof CatchDateField>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Error: Story = { args: { error: '釣行日を確認してください。' } };
