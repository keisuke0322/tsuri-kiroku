'use client';

import { useId, useRef, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { recipeLinks } from './recipe-links';

function RecipeIcon() {
  return (
    <svg
      data-cy="recipe-icon"
      width="26"
      height="26"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="8" stroke="#163b48" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="5.5" fill="#e98636" />
      <g
        stroke="#163b48"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 5v6c0 3 4 3 4 0V5M4 5v22" />
        <path d="M28 13v14" />
      </g>
      <ellipse cx="28" cy="9" rx="3" ry="5" fill="#163b48" />
    </svg>
  );
}

export default function RecipeMenu({ fishName }: { fishName: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const firstLink = useRef<HTMLAnchorElement>(null);
  const name = fishName.trim();
  if (!name) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="recipe-trigger"
          data-cy="recipe-trigger"
          aria-label={`${name}のレシピを探す`}
          title={`${name}のレシピを探す`}
          onKeyDown={(event) => {
            // Cancel native Enter activation before focus moves to an external link.
            if (event.key === 'Enter') {
              event.preventDefault();
              if (!event.repeat) event.currentTarget.click();
            }
          }}
        >
          <RecipeIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="recipe-popover"
        align="start"
        collisionPadding={12}
        aria-labelledby={titleId}
        data-cy="recipe-popover"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          firstLink.current?.focus();
        }}
      >
        <p id={titleId} className="recipe-heading">
          {name}のレシピ
        </p>
        <p className="recipe-hint">
          「釣り {name}」で検索 · 新しいタブで開きます
        </p>
        {recipeLinks(name).map((link, index) => (
          <a
            key={link.label}
            ref={index === 0 ? firstLink : undefined}
            data-cy="recipe-link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <button
          type="button"
          data-cy="recipe-close"
          className="recipe-close"
          onClick={() => setOpen(false)}
        >
          閉じる
        </button>
      </PopoverContent>
    </Popover>
  );
}
