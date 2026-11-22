import type { Meta, StoryObj } from '@storybook/react-vite';
import RecipeMenu from '@/app/recipe-menu';

const meta = {
  id: 'recipe-menu',
  title: '専用部品/レシピメニュー',
  component: RecipeMenu,
  args: { fishName: 'アジ' },
} satisfies Meta<typeof RecipeMenu>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { fishName: '' } };
