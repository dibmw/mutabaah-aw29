# PRD — UI Design System & Style Guide

> Guideline konsistensi UI untuk project React + Tailwind CSS.
> Extracted dari Sistem Input Mutabaah Al-Qur'an Siswa — Al-Wildan 29 Depok.

---

## 1. Project Stack

| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript ~5.8 | Type safety |
| Tailwind CSS 4 (v4, CSS-first config) | Utility-first CSS |
| Lucide React | Icon library |
| Vite 6 | Build tool |

**Note:** Tailwind v4 uses CSS-first configuration via `@import "tailwindcss"` — no `tailwind.config.js`.

---

## 2. Design Tokens

### 2.1 Brand Colors

| Name | Hex | Usage |
|---|---|---|
| **Navy Blue** | `#1E3A8A` | Primary brand. Headers, primary buttons, active states, section titles, links, focus ring |
| **Amber/Gold** | `#F59E0B` | Secondary accent. Icons on navy bg, button icon accents, border glow on primary buttons |
| **Dark Amber** | `#D97706` | Tertiary accent. Header bottom borders, panel dividers, Tahfidh theme accent |

### 2.2 Semantic Palette

| Category | Tailwind Colors | Usage |
|---|---|---|
| Success | `emerald-50` → `emerald-900` | Hadir, sync success, positive badges |
| Error | `rose-50` → `rose-900` | Sakit/Alpa, validation errors, destructive actions |
| Warning | `amber-50` → `amber-900` | Warnings, Tahfidh theme, alerts |
| Info/Selection | `blue-50` → `blue-900` | Selection highlights, active states |
| Neutral | `slate-50` → `slate-950` | Backgrounds, borders, text, surfaces |

### 2.3 Theme per Modul (Setoran Type)

| Theme | Background | Ring | Border | Text |
|---|---|---|---|---|
| **Tahsin** | `bg-[#1E3A8A]` | `ring-blue-800` | `border-blue-*` | `text-sky-*` |
| **Tahfidh** | `bg-[#D97706]` | `ring-amber-600` | `border-amber-*` | `text-amber-*` |
| **Tajwid** | `bg-purple-800` | `ring-purple-700` | `border-purple-*` | `text-purple-*` |
| **None** | `bg-slate-800` | `ring-slate-800` | `border-slate-*` | `text-slate-*` |

### 2.4 Page Background

```
bg-[#F8FAFC]   → page background
bg-white       → cards, surfaces
bg-slate-50    → inset sections, table headers
```

### 2.5 Text Selection

```css
selection:bg-[#1E3A8A] selection:text-white
```

---

## 3. Typography

### 3.1 Font Family

```tsx
// Root element
<div className="font-sans antialiased ...">
```

Tailwind default sans-serif stack.

### 3.2 Font Size Scale

| Token | Usage |
|---|---|
| `text-[10px]` | Micro labels, badge text, status badges (AKTIF, REQUIRED) |
| `text-[11px]` | Small labels, helper text, table header text, copyright |
| `text-xs` (0.75rem) | **Most common.** Form labels, button text, table cells, filter labels |
| `text-sm` (0.875rem) | Secondary headings, form input text (desktop), modal body text |
| `text-base` (1rem) | Page title, modal title (mobile) |
| `text-xl` (1.25rem) | Modal main title (desktop) |

**Responsive pattern:**
```tsx
"text-base sm:text-xl"     // title: base on mobile, xl on desktop
"text-xs sm:text-sm"       // input: xs on mobile, sm on desktop
"text-[11px] sm:text-xs"   // labels: 11px on mobile, xs on desktop
```

### 3.3 Font Weight Scale

| Token | Usage |
|---|---|
| `font-medium` (500) | Helper text, secondary info, muted labels |
| `font-semibold` (600) | Sub-labels, secondary buttons, table secondary text |
| `font-bold` (700) | **Common.** Labels, section headings, button text, badges, table headers |
| `font-extrabold` (800) | **Primary heading weight.** Main titles, section titles, panel headers, CTAs |
| `font-black` (900) | Score values, modal header icon containers |

### 3.4 Text Transform & Letter Spacing

```tsx
// Section headers:
"text-xs font-bold text-[#1E3A8A] uppercase tracking-wider"

// Table headers:
"text-[11px] font-extrabold text-slate-700 uppercase tracking-wider"

// Status badges:
"text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold uppercase"
```

### 3.5 Text Truncation

```tsx
"truncate"                    // single-line truncation
"min-w-0"                     // always pair with truncate in flex containers
"max-w-[140px] truncate"     // constrained truncation in table cells
"line-clamp-1"                // explicit line clamp
```

---

## 4. Buttons

### 4.1 Primary Action (Navy Blue)

```tsx
"py-3 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-sm rounded-xl
 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2
 border border-[#F59E0B]/30 active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed"

// Icon accent:
<Icon className="w-4 h-4 text-[#F59E0B]" />

// Loading state:
<Loader2 className="w-4 h-4 text-[#F59E0B] animate-spin" />
```

### 4.2 Full-Width Submit

```tsx
"w-full py-3.5 px-6 bg-[#1E3A8A] hover:bg-blue-900 text-white font-extrabold
 text-sm rounded-xl shadow-lg hover:shadow-xl transition-all
 border border-[#F59E0B]/40 flex items-center justify-center gap-2
 disabled:opacity-50 active:scale-[0.99]"
```

### 4.3 Secondary/Utility (Slate)

```tsx
"flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100
 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300
 transition-all active:scale-95 disabled:opacity-50 min-h-[38px]"
```

### 4.4 Green Action (WhatsApp)

```tsx
"flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600
 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-xs
 transition-all border border-emerald-500 min-h-[38px]"
```

### 4.5 Icon-Only Destructive

```tsx
"p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg
 transition-colors shrink-0 min-h-[28px] min-w-[28px] flex items-center
 justify-center border border-transparent hover:border-rose-200"
```

### 4.6 Segmented Radio Card (Setoran Selector)

```tsx
// Inactive:
"p-3 rounded-xl border text-left transition-all flex flex-col justify-between
 bg-white text-slate-700 border-slate-200 hover:bg-{color}-50"

// Active per theme:
Tahsin:  "bg-[#1E3A8A] text-white border-blue-900 shadow-md ring-2 ring-blue-800"
Tahfidh: "bg-[#D97706] text-white border-amber-800 shadow-md ring-2 ring-amber-600"
Tajwid:  "bg-purple-800 text-white border-purple-900 shadow-md ring-2 ring-purple-700"
```

### 4.7 Filter Toggle Button

```tsx
// Active:
"bg-[#1E3A8A] text-white border-blue-900 shadow-xs"

// Inactive:
"bg-blue-50 text-[#1E3A8A] border-blue-200 hover:bg-blue-100/80"

// Container:
"flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl
 text-xs font-extrabold transition-all border min-h-[40px]"
```

### 4.8 Minimum Touch Target

```tsx
"min-h-[38px]"   // header buttons, utility buttons
"min-h-[40px]"   // filter buttons
"min-h-[44px]"   // primary CTAs, modal action buttons
"min-w-[28px]"   // icon-only buttons
"min-w-[36px]"   // search clear buttons
```

---

## 5. Input & Form Patterns

### 5.1 Text Input

```tsx
"w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl
 text-base sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]
 focus:bg-white focus:outline-none transition-all disabled:opacity-60"
```

### 5.2 Number Input (Compact)

```tsx
"w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium
 focus:ring-2 focus:ring-[#1E3A8A]"
```

### 5.3 Date Input

```tsx
"w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold
 text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none min-h-[42px]"
```

### 5.4 Select Dropdown

```tsx
// Standard:
"w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold
 text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none min-h-[42px]"

// Compact:
"w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold
 text-slate-800 focus:ring-2 focus:ring-[#1E3A8A]"

// Disabled:
"w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs sm:text-sm
 font-bold text-slate-600 min-h-[42px] shadow-2xs cursor-not-allowed"
```

### 5.5 Filter Select (Inline Compact)

```tsx
// Container:
"flex items-center justify-between sm:justify-start gap-2 bg-slate-100
 hover:bg-slate-200/80 border border-slate-300 rounded-xl px-3 py-2
 transition-colors min-h-[40px]"

// Select inside:
"text-xs font-extrabold text-[#1E3A8A] bg-transparent focus:outline-none
 cursor-pointer text-right sm:text-left pr-1 min-w-0 truncate"
```

### 5.6 Textarea

```tsx
"w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-medium
 text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
```

### 5.7 Form Label

```tsx
// Standard:
"block text-xs font-bold text-slate-700 mb-1"

// With uppercase:
"block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider"

// Compact:
"block text-[11px] font-semibold text-slate-700 mb-1"
```

### 5.8 Required Field Indicator

```tsx
<span className="text-rose-600">*</span>
```

### 5.9 Helper Text

```tsx
"text-[11px] text-slate-500 mt-1.5 font-medium"
"text-[11px] text-slate-500 italic"
```

### 5.10 Validation Error

```tsx
// Error border:
className={`${hasError ? 'border-red-400' : 'border-slate-300'}`}

// Inline error message:
<p className="text-[10px] text-red-500 mt-1 font-medium">{errorMessage}</p>
```

### 5.11 Scroll Wheel Prevention (Number Inputs)

```tsx
onWheel={(e) => (e.target as HTMLInputElement).blur()}
```

> `e.preventDefault()` tidak bekerja di modern browsers karena passive event listeners.

### 5.12 Form Group Spacing

```tsx
"space-y-4"       // between form groups
"space-y-5"       // modal form
"space-y-6"       // between major sections (responsive: "space-y-4 sm:space-y-6")
"space-y-3.5"     // within a section
```

---

## 6. Card & Panel Patterns

### 6.1 Standard Card

```tsx
"bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3.5 sm:p-5"
```

### 6.2 Elevated Card

```tsx
"bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden"
```

### 6.3 Panel with Header Bar

```tsx
// Container:
"bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden"

// Header:
"bg-[#1E3A8A] px-6 py-4 border-b-2 border-[#D97706] text-white
 flex items-center justify-between"

// Body:
"p-4 sm:p-6 space-y-4 sm:space-y-6"
```

### 6.4 Section Card (Inset)

```tsx
"bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3.5"
```

### 6.5 Active Content Section (Colored)

```tsx
// Tahsin:
"p-4 rounded-xl border bg-blue-50/50 border-blue-300 space-y-4 animate-fade-in"

// Tahfidh:
"p-4 rounded-xl border bg-amber-50/50 border-amber-300 space-y-4 animate-fade-in"

// Tajwid:
"p-4 rounded-xl border bg-purple-50/50 border-purple-300 space-y-4 animate-fade-in"
```

### 6.6 Nested Input Grid

```tsx
"grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/80 p-3.5 rounded-xl border border-{color}-100 shadow-xs"
```

---

## 7. Modal Patterns

### 7.1 Modal Backdrop

```tsx
// Standard:
"fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"

// Full-screen mobile:
"fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
```

### 7.2 Modal Container

```tsx
// Small centered:
"bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"

// Responsive full-screen:
"bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl
 border-0 sm:border border-slate-200 overflow-hidden flex flex-col"
```

### 7.3 Modal Header

```tsx
// Centered (login):
"bg-[#1E3A8A] p-6 text-white text-center relative border-b-4 border-[#D97706]"

// Inline (report):
"bg-[#1E3A8A] text-white px-4 sm:px-6 py-3.5 sm:py-4 border-b-2 border-[#D97706]
 flex items-center justify-between shrink-0"
```

### 7.4 Modal Close Button

```tsx
"text-blue-200 hover:text-white p-2 rounded-xl hover:bg-blue-800/80 transition-colors
 min-w-[38px] min-h-[38px] flex items-center justify-center"
```

### 7.5 Modal Body

```tsx
"p-6 space-y-5"                                                // login
"p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-3.5 bg-slate-50" // scrollable report
```

### 7.6 Modal Footer

```tsx
"bg-slate-50 px-6 py-3.5 border-t border-slate-200/80 text-center rounded-b-2xl"

// Action footer:
"p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row
 items-center justify-between gap-3 shrink-0"
```

### 7.7 Modal Open/Close Guard

```tsx
if (!isOpen) return null;

return (
  <div className="fixed inset-0 z-50 ...">
    <div className="bg-white ...">
      {/* Header */}
      {/* Body */}
      {/* Footer */}
    </div>
  </div>
);
```

---

## 8. Table Patterns

### 8.1 Table Container

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-left border-collapse">
```

### 8.2 Table Header

```tsx
<tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold
 text-slate-700 uppercase tracking-wider">
  <th className="py-3 px-3.5 whitespace-nowrap">...</th>
</tr>
```

### 8.3 Table Body & Row

```tsx
<tbody className="divide-y divide-slate-200 text-xs text-slate-800">
  <tr className="hover:bg-slate-50/80 transition-colors">
    <td className="py-3 px-3.5 ...">...</td>
  </tr>
</tbody>
```

### 8.4 Empty State

```tsx
<div className="p-10 text-center bg-slate-50">
  <Icon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
  <h4 className="text-sm font-bold text-slate-700">Title</h4>
  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Description</p>
</div>
```

---

## 9. Badge, Chip & Tag Patterns

### 9.1 Attendance Badge

```tsx
// Hadir (green):
"inline-block px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase
 bg-emerald-100 text-emerald-800 border border-emerald-300"

// Sakit/Izin (amber):
"inline-block px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase
 bg-amber-100 text-amber-900 border border-amber-300"

// Alpa (red):
"inline-block px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase
 bg-rose-100 text-rose-800 border border-rose-300"
```

### 9.2 Data Type Badge

```tsx
// Tahsin:
"text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded"

// Tahfidh:
"text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded"

// Tajwid:
"text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded"
```

### 9.3 Section Status Badge

```tsx
// REQUIRED:
"text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold"

// OPTIONAL:
"text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold"

// AKTIF (per theme):
"text-[10px] bg-blue-100 text-[#1E3A8A] font-bold px-2 py-0.5 rounded"      // Tahsin
"text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded"     // Tahfidh
"text-[10px] bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded"   // Tajwid
```

### 9.4 Count Pill Badge

```tsx
"text-[11px] font-extrabold text-[#1E3A8A] bg-blue-100 px-2.5 py-0.5 rounded-full"
```

### 9.5 Tag Chip (Selected Items)

```tsx
"inline-flex items-center gap-1.5 bg-white text-slate-800 text-xs font-bold
 px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs"

// Sub-tag (class):
"text-[10px] text-[#1E3A8A] font-extrabold bg-blue-100 px-1.5 py-0.2 rounded"
```

### 9.6 Status Chip (Header Bar)

```tsx
"text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200"
```

---

## 10. Alert & Error Patterns

### 10.1 Error Alert Box

```tsx
"bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-xl flex items-start gap-3 animate-head-shake"

// Icon:
<ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />

// Title:
<h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider">Akses Ditolak</h4>

// Message:
<p className="text-xs text-rose-700 font-medium mt-0.5 leading-relaxed">...</p>
```

### 10.2 Warning Info Box (Amber)

```tsx
"bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs
 flex items-start gap-2 font-medium"

// Icon:
<AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />

// Strong text inside:
<strong className="font-bold block">...</strong>
```

---

## 11. Toast Pattern

### 11.1 Container

```tsx
"fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none"
```

### 11.2 Toast Item

```tsx
"pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-lg
 border text-sm font-medium transition-all duration-300 transform translate-y-0"

// Success:
"bg-emerald-900/90 border-emerald-700 text-emerald-100 backdrop-blur-md"

// Error:
"bg-rose-900/90 border-rose-700 text-rose-100 backdrop-blur-md"

// Info:
"bg-slate-900/90 border-slate-700 text-slate-100 backdrop-blur-md"

// Icons:
<CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
<AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
<Info className="w-5 h-5 text-sky-400 shrink-0" />

// Dismiss button:
"ml-3 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
```

**Auto-dismiss:** 4000ms.

---

## 12. Dropdown & Autocomplete

### 12.1 Container

```tsx
"absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200
 z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 animate-fade-in"
```

### 12.2 Sticky Header

```tsx
"sticky top-0 bg-slate-100 px-4 py-2.5 border-b border-slate-200
 flex items-center justify-between gap-2 z-10"
```

### 12.3 Row

```tsx
// Default:
"w-full text-left px-4 py-3 hover:bg-blue-50/80 transition-colors
 flex items-center justify-between gap-3 min-h-[56px] cursor-pointer"

// Selected:
"bg-blue-100/70 border-l-4 border-[#1E3A8A]"
```

### 12.4 Empty State

```tsx
"p-6 text-center text-slate-500"
<Icon className="w-8 h-8 text-amber-500 mx-auto mb-2" />
<p className="text-xs font-semibold">Tidak ada data ditemukan.</p>
<p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci lain.</p>
```

---

## 13. Layout System

### 13.1 Page Root

```tsx
<div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col antialiased
 selection:bg-[#1E3A8A] selection:text-white">
```

### 13.2 Main Content

```tsx
<main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
```

### 13.3 Sticky Header

```tsx
<header className="bg-white text-slate-800 shadow-sm border-b border-slate-200 sticky top-0 z-30">
  <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3
   flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
```

### 13.4 Dual-Panel Grid

```tsx
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
  <div className="lg:col-span-6 space-y-4">  {/* Left panel */}
  <div className="lg:col-span-6 space-y-4">  {/* Right panel */}
```

### 13.5 Flex-Row Responsive Collapse

```tsx
"flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4"
"flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4"
```

### 13.6 Footer

```tsx
<footer className="bg-white border-t border-slate-200 py-4 mt-8 text-xs text-slate-500">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row
   items-center justify-between gap-2.5">
```

### 13.7 Responsive Breakpoints

| Prefix | Breakpoint | Usage |
|---|---|---|
| (none) | 0px | Mobile default: single column, stacked |
| `xs:` | Custom | 2-column filter grids |
| `sm:` | 640px | **Primary desktop breakpoint.** Font bumps, padding, row layouts |
| `md:` | 768px | Flex-row conversion, wider layout |
| `lg:` | 1024px | 12-column grid, dual-panel, max-width container |

---

## 14. Icon Usage

### 14.1 Size Scale

| Size | Class | Usage |
|---|---|---|
| Tiny | `w-3 h-3` | Remove/dismiss buttons |
| Small | `w-3.5 h-3.5` | Inline icons in buttons, labels |
| Default | `w-4 h-4` | **Most common.** Form section icons, button icons |
| Medium | `w-5 h-5` | Panel header icons, toast icons, error alerts |
| Large | `w-6 h-6` | Empty state icons, modal body icons |
| XL | `w-8 h-8` | Login modal header icon |
| Huge | `w-10 h-10` | Empty state illustrations |

### 14.2 Icon + Text Pairing

```tsx
// Button:
<div className="flex items-center gap-1.5">
  <Icon className="w-3.5 h-3.5" />
  <span>Label</span>
</div>

// Label:
<div className="flex items-center gap-1.5">
  <Icon className="w-4 h-4 text-[#D97706]" />
  <span>Label Text</span>
</div>

// Section icon container:
<div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-100 text-[#1E3A8A]
 flex items-center justify-center font-bold shrink-0">
  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E3A8A]" />
</div>
```

---

## 15. Animations & Transitions

### 15.1 Custom Animations

```tsx
"animate-fade-in"      // modal backdrop, dropdown, active sections
"animate-head-shake"   // error alert box
"animate-spin"         // loader icons (Loader2, RefreshCw)
```

### 15.2 Transition Classes

```tsx
"transition-all"              // buttons, inputs, cards
"transition-colors"           // icon buttons, rows, links
"transition-all duration-300" // toast items
```

### 15.3 Transform Effects

```tsx
"active:scale-95"         // secondary buttons, utility buttons
"active:scale-[0.99]"     // primary CTA buttons (subtle)
"hover:scale-105"         // logo hover
"rotate-180"              // chevron toggle (with transition-transform duration-200)
```

---

## 16. Shadows

| Token | Usage |
|---|---|
| `shadow-2xs` | Subtle cards, chips, filter buttons |
| `shadow-xs` | Green buttons, active filter toggle |
| `shadow-sm` | Page header, subtle borders |
| `shadow-md` | Standard cards, active radio cards |
| `shadow-lg` | Primary CTA buttons |
| `shadow-xl` | Primary CTA hover state |
| `shadow-2xl` | Modals, dropdowns |
| `shadow-inner` | Dark text display boxes |

---

## 17. Borders & Rounded Corners

### 17.1 Rounded Corners

| Token | Usage |
|---|---|
| `rounded` | Small tags, pill badges |
| `rounded-lg` | Buttons, chips, compact inputs |
| `rounded-xl` | **Most common.** Cards, inputs, buttons, sections, badges |
| `rounded-2xl` | Cards, modals, large containers |
| `rounded-md` | Attendance badges |
| `rounded-r-xl` | Error alert (right side) |

### 17.2 Border Patterns

```tsx
"border border-slate-200"        // standard card border
"border border-slate-200/80"     // semi-transparent card border
"border border-slate-300"        // input borders, filter containers
"border border-transparent"      // hover-reveal border
"border-b border-slate-200"      // dividers
"border-b-2 border-[#D97706]"   // panel header bottom accent
"border-b-4 border-[#D97706]"   // modal header bottom accent (thicker)
"border-l-4 border-rose-600"     // error alert left accent
"border-l-4 border-[#1E3A8A]"   // selected dropdown row left accent
```

---

## 18. Component Architecture

### 18.1 State Management

- **No global state library** — all state in root `App.tsx` via `useState`
- **Lift state up** pattern: root holds master data, selected items, toasts
- **Local state** for UI-only concerns (dropdown open, search term, form values)
- **`useCallback`** for all handlers passed as props
- **`useMemo`** for expensive computed values
- **`useEffect`** for side effects: data init, syncing, click-outside detection

### 18.2 Component Interface

```tsx
interface ComponentNameProps {
  propName: PropType;
  onAction: (arg: Type) => void;
}

export const ComponentName: React.FC<ComponentNameProps> = ({ ... }) => {
```

### 18.3 Data Flow

```
App.tsx
  ↓ props (data + callbacks)
Child Components
  ↓ events (callbacks up)
App.tsx
  ↓ addToast() for notifications
ToastContainer
```

### 18.4 Service Layer

```tsx
// Static class pattern (no instantiation):
ServiceClass.getUsers()
ServiceClass.addLog(data, user)
ServiceClass.fetchData()  // async
```

---

## 19. Spacing Quick Reference

### Container Padding

```
p-3      → toast items
p-3.5    → search card, compact sections
p-4      → sections within cards, form sections
p-5      → modal body
p-6      → modal header, modal body sections
p-8      → empty state panels
p-10     → table empty state
```

### Section Spacing (space-y)

```
space-y-0.5  → table cell inner
space-y-1    → tight content grouping
space-y-2    → chip list
space-y-3    → form sections within cards
space-y-3.5  → modal body sections
space-y-4    → form groups, active sections
space-y-5    → modal form
space-y-6    → main page sections between cards
```

### Gap Scale

```
gap-0.5  → inline tag gaps
gap-1    → inline element gaps
gap-1.5  → chip internal, icon + text
gap-2    → button groups, filter items
gap-2.5  → header layout, filter bar
gap-3    → form field rows
gap-4    → grid column gaps, flex layouts
gap-6    → dual-panel grid
```

---

## 20. Accessibility Checklist

```tsx
// Autocomplete disabling:
autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"

// Native validation:
required

// Type attributes:
type="email"
type="text"
type="number" (with min/max)

// Tooltip:
title="Description text"
```
