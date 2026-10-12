'use client';

import {useId, useRef, useState} from 'react';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {recipeLinks} from './recipe-links';

function RecipeIcon() {
  return <svg data-cy="recipe-icon" width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <g stroke="#163b48" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 7 5 5m-2-8 5 5m-2-8 5 5c3 3-2 8-5 5L4 7m8 6 14 14"/>
      <path d="m18 15-13 13"/>
    </g>
    <ellipse cx="22" cy="10" rx="4" ry="6" transform="rotate(40 22 10)" fill="#163b48"/>
    <path d="m28 1 1.2 2.8L32 5l-2.8 1.2L28 9l-1.2-2.8L24 5l2.8-1.2Z" fill="#e98636"/>
  </svg>;
}

export default function RecipeMenu({fishName}: {fishName: string}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const firstLink = useRef<HTMLAnchorElement>(null);
  const name = fishName.trim();
  if (!name) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="recipe-trigger" data-cy="recipe-trigger" aria-label={`${name}のレシピを探す`} title={`${name}のレシピを探す`} onKeyDown={event => {
        // Cancel native Enter activation before focus moves to an external link.
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!event.repeat) event.currentTarget.click();
        }
      }}>
        <RecipeIcon/>
      </button>
    </PopoverTrigger>
    <PopoverContent className="recipe-popover" align="start" collisionPadding={12} aria-labelledby={titleId} data-cy="recipe-popover" onOpenAutoFocus={event => {
      event.preventDefault();
      firstLink.current?.focus();
    }}>
      <p id={titleId} className="recipe-heading">{name}のレシピ</p>
      <p className="recipe-hint">「釣り {name}」で検索 · 新しいタブで開きます</p>
      {recipeLinks(name).map((link, index) => <a key={link.label} ref={index === 0 ? firstLink : undefined} data-cy="recipe-link" href={link.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{link.label}</a>)}
      <button type="button" data-cy="recipe-close" className="recipe-close" onClick={() => setOpen(false)}>閉じる</button>
    </PopoverContent>
  </Popover>;
}
