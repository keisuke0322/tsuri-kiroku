import type { Meta, StoryObj } from '@storybook/react-vite';
import Brand from '@/app/brand';

const meta = {
  id: 'brand',
  title: '専用部品/ブランド',
  component: Brand,
  args: { variant: 'header' },
} satisfies Meta<typeof Brand>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Login: Story = { args: { variant: 'login' } };
