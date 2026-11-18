import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const meta = {
  id: 'dialog',
  title: '共通部品/ダイアログ',
  component: Dialog,
} satisfies Meta<typeof Dialog>;
export default meta;
export const Default: StoryObj<typeof meta> = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>詳細を開く</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>釣行の詳細</DialogTitle>
          <DialogDescription>
            共通ダイアログの表示例です。Escapeキーで閉じられます。
          </DialogDescription>
        </DialogHeader>
        <div>架空の釣行データ</div>
        <DialogFooter>実データの取得・保存は行いません。</DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
