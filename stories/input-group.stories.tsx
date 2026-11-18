import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
} from '@/components/ui/input-group';

const meta = {
  id: 'input-group',
  title: '共通部品/入力グループ',
  component: InputGroup,
} satisfies Meta<typeof InputGroup>;
export default meta;
export const Default: StoryObj<typeof meta> = {
  render: () => (
    <InputGroup>
      <InputGroupInput type="number" aria-label="魚の長さ" placeholder="長さ" />
      <InputGroupAddon align="inline-end">
        <InputGroupText>cm</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};
