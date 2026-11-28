import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

const meta = {
  id: 'accordion',
  title: '共通部品/アコーディオン',
  component: Accordion,
  args: { type: 'single' },
} satisfies Meta<typeof Accordion>;
export default meta;
export const Default: StoryObj<typeof meta> = {
  render: () => (
    <div className="w-[min(100%,640px)] p-4">
      <Accordion type="single" collapsible>
        <AccordionItem value="gear">
          <AccordionTrigger>道具の情報</AccordionTrigger>
          <AccordionContent>
            ロッドやリールなどの情報をまとめます。
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="disabled" disabled>
          <AccordionTrigger>準備中</AccordionTrigger>
          <AccordionContent>未使用</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
