import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';

const meta = {
  id: 'button',
  title: '共通部品/ボタン',
  component: Button,
  args: {
    children: '保存する',
    variant: 'default',
    size: 'default',
    disabled: false,
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          '主要操作はdefault、補助操作はoutline、削除はdestructiveを使用します。アイコンのみの場合はaria-labelを指定します。',
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Variants: Story = {
  render: (args) => (
    <div className="story-row">
      {(
        [
          'default',
          'secondary',
          'outline',
          'ghost',
          'destructive',
          'link',
        ] as const
      ).map((variant) => (
        <Button {...args} key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
export const Sizes: Story = {
  render: (args) => (
    <div className="story-row">
      {(['xs', 'sm', 'default', 'lg'] as const).map((size) => (
        <Button {...args} key={size} size={size}>
          {size}
        </Button>
      ))}
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
export const AppActions: Story = {
  render: (args) => (
    <div className="story-row">
      <Button {...args} className="add-button">
        釣果を記録する
      </Button>
      <Button {...args} className="save-button">
        保存する
      </Button>
    </div>
  ),
};
