'use client';

import {useId, useRef, useState} from 'react';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {recipeLinks} from './recipe-links';

function RecipeIcon() {
  return <svg data-cy="recipe-icon" width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 8C12 5 7 5 3 7v20c4-2 9-2 13 1 4-3 9-3 13-1V7c-4-2-9-2-13 1Zm0 0v20" stroke="#163b48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 16c2-4 5-4 7 0-2 4-5 4-7 0Zm0 0-2-2v4l2-2Z" fill="#e98636"/>
    <circle cx="11" cy="15.5" r=".8" fill="#163b48"/>
    <path d="M20 12h5m-5 5h5m-5 5h3" stroke="#163b48" strokeWidth="2" strokeLinecap="round"/>
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
      <button type="button" className="recipe-trigger" data-cy="recipe-trigger" aria-label={`${name}のレシピを探す`} onKeyDown={event => {
        // Cancel native Enter activation before focus moves to an external link.
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!event.repeat) event.currentTarget.click();
        }
      }}>
        <RecipeIcon/><span>レシピ</span>
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
