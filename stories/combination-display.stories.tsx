import type { Meta, StoryObj } from '@storybook/react-vite';
import { CombinationDisplay } from '@/app/gear-controls';

const meta = {
  id: 'combination-display',
  title: '専用部品/道具の組み合わせ',
  component: CombinationDisplay,
  args: {
    value: {
      setId: null,
      setName: '海釣り基本セット',
      method: 'サビキ',
      gear: [
        {
          id: null,
          kind: 'ロッド',
          name: 'サンプルロッド',
          manufacturer: '',
          model: '',
          spec: '3m',
        },
      ],
      species: ['アジ'],
    },
  },
} satisfies Meta<typeof CombinationDisplay>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = {
  args: {
    value: { setId: null, setName: '', method: '', gear: [], species: [] },
  },
};
