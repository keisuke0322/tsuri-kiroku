import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/app/profile-dialog';

const meta = {
  id: 'avatar',
  title: '専用部品/アバター',
  component: Avatar,
  args: { name: '釣り人' },
} satisfies Meta<typeof Avatar>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { name: '' } };
export const LongName: Story = { args: { name: '海辺の釣り愛好家' } };
