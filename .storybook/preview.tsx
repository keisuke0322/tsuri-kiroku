import type { Preview } from '@storybook/react-vite';
import './storybook.css';

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    options: { storySort: { order: ['デザイン指針', '共通部品', '専用部品'] } },
    docs: { toc: true },
  },
};

export default preview;
