import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';

const options = ['テンヤ', '浮き釣り', 'サビキ', 'ルアー'];
function Example({ disabled = false }: { disabled?: boolean }) {
  return (
    <Combobox items={options}>
      <ComboboxInput
        aria-label="釣り方"
        placeholder="候補を選択"
        disabled={disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>候補がありません</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const meta = {
  id: 'combobox',
  title: '共通部品/コンボボックス',
  component: Example,
} satisfies Meta<typeof Example>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
