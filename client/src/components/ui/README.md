# SpreadFast design system

Shared components supply presentation primitives. Components do not
fetch data, choose routes, authenticate users or manage payments. Pass existing
API values and handlers from the page that owns them.

## Foundations

Tokens: `../../styles/design-system.css`, loaded by `src/index.js`.
Tailwind utilities: `client/tailwind.config.js`.

| Foundation | Value / usage |
| --- | --- |
| Font | Native system sans-serif; no font download |
| Primary / hover / tint | `#008050` / `#006941` / `#E8F7F0`; `bg-primary`, `text-primary`, `border-primary` |
| Page / surface / muted surface | `#F7F9FA` / `#FFFFFF` / `#F1F5F7`; `bg-canvas`, `bg-surface`, `bg-surface-muted` |
| Text / muted | `#0F2435` / `#576B7D`; `text-ink`, `text-muted` |
| Decorative / control border | `#E2E9EE` / `#A4B4BF` |
| Content / reading width | 1200px including gutters / 672px; `max-w-content`, `max-w-reading` |
| Radius | 6px small, 10px controls, 16px cards, 24px panels, pill badges |
| Shadows | `shadow-soft`, `shadow-card`, `shadow-floating` |
| Spacing | Existing Tailwind 4px scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px |
| Gutters | 16px mobile, 24px at sm, 32px at lg; `px-gutter` |
| Section spacing | 48px mobile, 64px at sm, 80px at lg; `py-section` |

Typography: `text-display`, `text-title`, `text-heading`, `text-body`,
`text-small`, `text-caption`. Matching `sf-*` classes are available. Display and
title scale fluidly. Use semantic h1/h2/h3 independent of visual size. Body and
input text are 16px; inputs avoid iOS focus zoom.

Breakpoints retain Tailwind defaults: **sm 640, md 768, lg 1024, xl 1280,
2xl 1536px**. Start with one column, then add columns with `md:`/`lg:`.

## Components

Import from `../components/ui` in a page.

| Component | Options |
| --- | --- |
| Button | `variant`: primary, secondary, ghost, danger; `size`: sm, md, lg; `fullWidth`; defaults to `type="button"` |
| Input | Native text/email/password/number/URL input props and ref |
| Textarea / Select | Native props, children and ref |
| Badge | `tone`: neutral, success, warning, danger, info; caller supplies text |
| Card | `variant`: default, flat, muted; `as` sets its semantic element |
| Container | `as` sets its semantic element; responsive gutters and max-width |

All accept `className` and DOM props. Controls forward refs and handlers. Set
`type="submit"` explicitly. Native validation and `aria-*` props remain intact.
Input is for textual controls; checkbox/radio/file inputs need later primitives.

```jsx
import { Button, Card, Container, Input } from '../components/ui';

// Values, validation and handlers belong to the existing page.
<main className="sf-page sf-section">
  <Container>
    <Card>
      <form className="sf-form" onSubmit={handleSubmit}>
        <div className="sf-stack">
          <div className="sf-field">
            <label className="sf-label" htmlFor="campaign-title">Campaign title</label>
            <Input id="campaign-title" value={title} onChange={handleTitleChange}
              required aria-invalid={Boolean(error)}
              aria-describedby={error ? 'campaign-title-error' : undefined} />
            {error && <p id="campaign-title-error" className="sf-field-error">{error}</p>}
          </div>
          <Button type="submit" disabled={loading}>Continue</Button>
        </div>
      </form>
    </Card>
  </Container>
</main>
```

Keep React Router `Link` and existing destinations for navigation. Button-styled
links use `sf-control sf-button` plus the variant class; links do not support
native `disabled`. Decorative SVG icons should use `aria-hidden="true"`,
`currentColor`, and simple 1.5–2px strokes. Icon-only buttons need accessible names.

## Adoption

Do not combine primitives with legacy `btn-primary`, `card`, `auth-form`, or
`wallet-section` classes on the same form/card. Use `sf-form` to reset the old
global form surface. Legacy page CSS remains until those pages are redesigned.

Namespaced CSS stays outside Tailwind layers so primitives are available before
page adoption. Use variants for control appearance; utilities are mainly for
surrounding layout and may not override component selectors. Cards have no
automatic hover lift. Controls have 44px minimum targets, visible focus,
disabled/error states, and reduced-motion support.

Global changes are limited to body font/background/text and shared primary color.
Hard-coded page colors/layouts are not migrated. Reference-image names, balances
and metrics must never replace API data.

## Dashboard component library

Import from the `ui` entrypoint to load `components.css` together with the named
exports. Existing Button/Card/Input exports remain compatible; their implementation
now lives in `primitives.jsx`. Each dashboard component has its own file. If using
a direct file import, also load `components/ui/components.css` once.

| Component | Data and composition contract |
| --- | --- |
| AppShell | `navigation`, `brand`, `header`, `sidebarFooter`, `mobileActions`, `mainId`, `children` |
| Sidebar | `items`, `brand`, `footer`, accessible `label` |
| MobileNavigation | Same `items`, compact `actions`, accessible `label` |
| PageHeader | `title`, `description`, `eyebrow`, `actions`, optional children; `as` sets heading tag |
| StatCard | `label`, `value`, `icon`, `description`, `loading` |
| CampaignCard | `title`, `description`, `imageSrc`, `imageAlt`, `status`, `platforms`, `budget`, `budgetLabel`, `metadata`, `actions`, optional `to`, `headingAs` |
| CampaignStatusBadge | API `status`, optional display `label`; no status updates |
| EmptyState | `title`, `description`, `icon`, `action`; `as` sets heading tag |
| FormField | `label`, `id`, `hint`, `error`, `required`, one child control (defaults to Input) |
| SearchBar | Controlled `value`, native `onChange(event)`, optional `onClear`, `label`, native input props and ref |
| PlatformBadge | `platform` string and optional decorative `icon` |
| WalletBalanceCard | Caller-formatted `balance`, `label`, `description`, `action`, `loading` |
| UserAvatar | `name`, optional image `src`, `size`: sm/md/lg; falls back to initials or a user icon |

All support `className`. Optional actions are React elements, so callers retain
their existing disabled conditions, handlers and link destinations. Pass already
formatted monetary values to cards; they do not calculate earnings, fees, slots,
or withdrawals. Zero remains zero; absent values show an em dash; loading does
not display a fictitious zero balance. CampaignCard does not infer API field
names, fetch images/assets, subscribe, or construct campaign-detail routes.
The image element simply displays the supplied URL, with a neutral fallback.

Navigation items have `{ id, label, to, icon, end }`. Supply only existing routes
allowed for the current role. Both navigation surfaces use NavLink; exact matching
is the default (`end: false` opts into descendants). No routes are defined by the
library. Logout remains a caller-owned action, not a special navigation item.

AppShell must be under the existing router. Below 1024px it shows a mobile header
and fixed bottom navigation; at 1024px it uses a sticky desktop sidebar. All mobile
destinations remain available through horizontal scrolling. AppShell reserves
bottom space including the device safe area. Standalone MobileNavigation consumers
must reserve the same space. Keep mobileActions compact (for example, one labeled
icon button) so links retain usable width. Supply mobile actions separately from
desktop footer content. Brand defaults to a non-interactive SpreadFast mark;
pass a Link element if a home destination is wanted. Header can hold a UserAvatar.

```jsx
// Illustrative composition only; no page is migrated by the library.
// Every variable below is supplied by the existing page/controller.
<AppShell navigation={navigation} header={<UserAvatar name={user?.name} />}
  sidebarFooter={logoutAction} mobileActions={mobileLogoutAction}>
  <PageHeader title="Campaigns" description="Manage your campaigns" actions={pageActions} />
  <SearchBar value={searchTerm} onChange={handleSearchChange} onClear={clearSearch} />
  <div className="sf-stack">
    {campaigns.map(campaign => (
      <CampaignCard key={campaign.id} title={campaign.title}
        description={campaign.description} status={campaign.status}
        platforms={campaign.socialMediaPlatforms || []}
        budget={formatBudget(campaign.budget)} actions={renderCampaignActions(campaign)} />
    ))}
  </div>
</AppShell>
```

FormField clones exactly one native/control child to associate its label, hint and
error. Existing refs, values, validation constraints, handlers and described-by
IDs survive. Error messages are announced; validation remains the caller's job.
Provide controls that forward id/aria/required props to their native element.
SearchBar does not filter, debounce, submit or call an API; onClear is optional.
Status/Platform badges change labels and appearance only, never backend values.
Unknown statuses get neutral styling rather than being presented as active.

Component behavior checks: `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/ui/components.test.jsx`
(run from `client`). They cover route preservation, form associations, native
submission, disabled controls, callbacks, missing/zero values and avatar recovery.

## UI consistency audit

Use Alert for error, warning, success and information messages; it preserves child content and supplies a decorative status icon plus the correct live-region role. Use AuthLayout for account/recovery screens, and FileTypeIcon for asset types. UiIcon owns the line-icon set; avoid emoji glyphs in presentation. BrandMark uses the official logo asset.

Dashboard page widths, headings and gutters belong to AppShell/DashboardShell. Avoid page-specific overrides and duplicated wrapper cards. Buttons use the 44px control-height token. Keep image/illustration styling separate from interactive control styles.

Retained legacy selectors are centralized in styles/legacy-ui.css; do not add global form, header, nav or button surface styles.
