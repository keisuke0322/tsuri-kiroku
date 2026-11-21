import type { Meta, StoryObj } from '@storybook/react-vite';

function DesignTokens() {
  return (
    <div className="story-stack">
      <h1>既存のデザイン設定</h1>
      <p>app/globals.cssの変数を直接参照しています。</p>
      <div className="story-row">
        {[
          'primary',
          'secondary',
          'background',
          'foreground',
          'muted',
          'destructive',
          'border',
        ].map((name) => (
          <div key={name} className="story-token">
            <div
              style={{
                background: `var(--${name})`,
                width: 80,
                height: 48,
                border: '1px solid var(--border)',
              }}
            />
            <code>--{name}</code>
          </div>
        ))}
      </div>
      <h2>見出し</h2>
      <p>本文：釣った魚、出かけた場所、あの瞬間をいつでも振り返れる。</p>
      <div className="story-token">
        角丸：var(--radius) ／ 書体：アプリ共通の日本語フォント
      </div>
    </div>
  );
}

const meta = {
  id: 'design-tokens',
  title: 'デザイン指針/色と文字',
  component: DesignTokens,
} satisfies Meta<typeof DesignTokens>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
