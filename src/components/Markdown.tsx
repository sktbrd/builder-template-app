'use client'

import * as React from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

type Props = {
  children: string
  className?: string
}

/**
 * Render proposal descriptions / propdates / mission text from raw markdown.
 *
 * Mirrors the rendering strategy used by gnars-website:
 *   - GFM tables / strikethrough / task lists / autolinks
 *   - Soft line breaks → <br>
 *   - Slug ids on headings + anchor link on hover
 *   - External links open in a new tab with rel=noopener
 *   - Sanitized for security (rehype-sanitize)
 *
 * Uses the @tailwindcss/typography plugin (`prose`) for default rhythm,
 * then overrides links / code / blockquote / table to thread the DAO's
 * accent token + design surfaces. Theme tokens stay config-driven.
 */
export function Markdown({ children, className }: Props) {
  if (!children) return null
  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none dark:prose-invert',
        'prose-h1:scroll-mt-24 prose-h2:scroll-mt-24 prose-h3:scroll-mt-24',
        'prose-headings:font-display prose-headings:tracking-tight',
        'prose-a:break-words',
        'prose-pre:rounded-md prose-pre:bg-surface-2 prose-pre:p-4',
        'prose-code:before:hidden prose-code:after:hidden',
        'prose-img:rounded-md prose-img:border prose-img:border-border',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: 'append',
              properties: {
                className: ['ml-1.5', 'no-underline', 'opacity-0', 'hover:opacity-60'],
                ariaHidden: 'true',
                tabIndex: -1,
              },
            },
          ],
          [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
          [
            rehypeSanitize,
            {
              ...defaultSchema,
              attributes: {
                ...defaultSchema.attributes,
                a: [...(defaultSchema.attributes?.a ?? []), ['a', 'target'], ['a', 'rel']],
                code: [...(defaultSchema.attributes?.code ?? []), ['code', 'className']],
              },
            },
          ],
        ]}
        components={MARKDOWN_COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

const MARKDOWN_COMPONENTS: Components = {
  a({ className, href, children, ...props }) {
    return (
      <a
        href={typeof href === 'string' ? href : undefined}
        className={cn(
          'font-medium text-accent-strong underline decoration-accent-strong/40 hover:decoration-accent-strong',
          className
        )}
        {...props}
      >
        {children}
      </a>
    )
  },
  img({ src, alt, ...props }) {
    if (!src) return null
    const url = typeof src === 'string' ? src : ''
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          loading="lazy"
          src={url}
          alt={typeof alt === 'string' ? alt : ''}
          className="mx-auto my-3 max-h-[480px] w-auto max-w-full rounded-md border border-border"
          {...props}
        />
      </a>
    )
  },
  table({ className, ...props }) {
    return (
      <div className="not-prose w-full overflow-x-auto rounded-md border border-border">
        <table
          className={cn('w-full border-collapse text-sm', className)}
          {...props}
        />
      </div>
    )
  },
  th({ className, ...props }) {
    return (
      <th
        className={cn(
          'border-b border-border bg-surface-2 px-3 py-2 text-left font-semibold',
          className
        )}
        {...props}
      />
    )
  },
  td({ className, ...props }) {
    return (
      <td
        className={cn('border-b border-border px-3 py-2 align-top', className)}
        {...props}
      />
    )
  },
  pre({ className, ...props }) {
    return (
      <pre
        className={cn(
          'overflow-x-auto rounded-md border border-border bg-surface-2 p-4 text-[13px]',
          className
        )}
        {...props}
      />
    )
  },
  code(props) {
    const { className, children, ...rest } =
      props as React.HTMLAttributes<HTMLElement> & {
        className?: string
        children?: React.ReactNode
      }
    const isBlock =
      typeof className === 'string' && className.includes('language-')
    if (isBlock) {
      return (
        <code className={cn('font-mono text-[13px]', className)} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code
        className={cn(
          'rounded bg-surface-2 px-1 py-0.5 font-mono text-[12.5px]',
          className
        )}
        {...rest}
      >
        {children}
      </code>
    )
  },
  blockquote({ className, ...props }) {
    return (
      <blockquote
        className={cn(
          'border-l-2 border-border pl-4 italic text-muted-fg',
          className
        )}
        {...props}
      />
    )
  },
}
