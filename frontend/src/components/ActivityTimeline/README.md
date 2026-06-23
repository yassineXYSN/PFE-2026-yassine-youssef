# Activity Timeline Component - Documentation

## Overview

An enhanced, professional timeline component for displaying activity histories, event logs, and status updates with modern UI/UX.

## Features

✨ **Modern Design**
- Vertical timeline with animated connector lines
- Icon-based event indicators
- Smooth fade-in animations

👥 **Professional UX**
- Expandable/collapsible timeline for long lists
- Fade gradient effect for "show more" indication
- Responsive design (mobile, tablet, desktop)
- Dark mode support

⚡ **Interactive Elements**
- Hover effects on timeline items
- Action buttons for each event
- Smooth transitions and transforms
- Optimized for touch devices

## Usage

### Basic Example

```jsx
import ActivityTimeline from '@/components/ActivityTimeline/ActivityTimeline';

const events = [
  {
    id: 1,
    label: 'Application Received',
    date: '2026-04-06T16:35:00Z',
    type: 'received',
    primary: false
  },
  {
    id: 2,
    label: 'AI Screening Completed',
    date: '2026-04-06T16:35:00Z',
    type: 'ai_screening',
    primary: false
  },
  {
    id: 3,
    label: 'Moved to Interview',
    date: '2026-04-06T18:50:00Z',
    type: 'moved_to',
    primary: true
  }
];

<ActivityTimeline 
  events={events}
  title="Application History"
  maxVisibleItems={6}
/>
```

### With Action Buttons

```jsx
const eventsWithActions = [
  {
    id: 1,
    label: 'Quiz Available',
    type: 'quiz',
    date: '2026-04-06T16:35:00Z',
    primary: true,
    action: 'Start Quiz',
    onAction: () => navigate('/quiz/123')
  },
  {
    id: 2,
    label: 'Interview Scheduled',
    type: 'interview',
    date: '2026-04-07T10:00:00Z',
    primary: true,
    action: 'Join Meeting',
    onAction: () => navigate('/interview/room/123')
  }
];

<ActivityTimeline events={eventsWithActions} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `events` | Array | `[]` | Array of event objects to display |
| `title` | String | `"Activity Timeline"` | Timeline section title |
| `maxVisibleItems` | Number | `6` | Maximum events to show before expand button appears |

## Event Object Structure

```typescript
interface TimelineEvent {
  id: string | number;           // Unique identifier
  label: string;                 // Event title/label (required)
  date?: string;                 // ISO date string
  formattedDate?: string;        // Pre-formatted date for display
  type?: string;                 // Event type for icon selection
  description?: string;          // Optional event description
  primary?: boolean;             // true = highlight with accent color
  isError?: boolean;             // true = show error styling
  action?: string;               // Optional button label
  onAction?: () => void;         // Optional action callback
}
```

## Event Types & Icons

Automatically selects icons based on event type:

| Type | Icon | Use Case |
|------|------|----------|
| `received` | inbox | Application/submission received |
| `ai_screening` | psychology | AI analysis completed |
| `moved_to` | arrow_forward | Status changed |
| `quiz` | quiz | Quiz assignment |
| `interview` | videocam | Interview scheduled |
| `accepted` | check_circle | Offer accepted |
| `rejected` | cancel | Application rejected |
| `completed` | task_alt | Task completed |
| `default` | event | Unknown/generic event |

## Styling & Theming

The component automatically adapts to:
- **Light Mode**: Clean white backgrounds with dark text
- **Dark Mode**: Dark backgrounds with light text, reduced opacity
- **CSS Variables**: Uses theme variables from `var(--tf-primary)`, `var(--tf-surface)`, etc.

## Customization

### Colors Per Event

```jsx
const events = [
  {
    id: 1,
    label: 'Success Event',
    type: 'completed',
    primary: true,
    date: 'Today at 10:00 AM'
  },
  {
    id: 2,
    label: 'Error Event',
    date: 'Yesterday at 3:00 PM',
    isError: true
  }
];
```

- `primary: true` → Highlights with accent color
- `isError: true` → Shows red error styling
- Default → Neutral gray styling

### Responsive Behavior

- **Desktop**: Full timeline with all features
- **Tablet**: Adjusted padding and spacing
- **Mobile**: Optimized dot sizes, responsive font sizes

## Animation Details

- **Item entrance**: Staggered slide-in from left (0.5s ease-out)
- **Expansion delay**: 100ms between each item
- **Hover effect**: Subtle translate right (4px) with smooth transition
- **Connector line**: Animates on hover from secondary to primary color

## Integration Example

Update your existing timeline component by replacing:

```jsx
// Before
<div className="tf-history-list">
  {history.map((entry, idx) => (
    <div className="tf-history-item" key={idx}>
      <div className={`tf-history-dot ${entry.primary ? 'tf-dot-primary' : 'tf-dot-muted'}`}></div>
      <div>
        <p className="tf-history-event">{entry.label}</p>
        <p className="tf-history-time">{formatDate(entry.date)}</p>
      </div>
    </div>
  ))}
</div>

// After
<ActivityTimeline 
  events={history.map((entry, idx) => ({
    id: idx,
    label: entry.label,
    formattedDate: formatDate(entry.date),
    type: entry.type || 'default',
    primary: entry.primary,
    isError: entry.isError
  }))}
/>
```

## Accessibility

- ✅ Semantic HTML structure
- ✅ Proper heading hierarchy (h3 title)
- ✅ Icon labels with `aria-labels` (can be added)
- ✅ Sufficient color contrast ratios
- ✅ Keyboard navigable buttons
- ✅ Touch-friendly interaction areas

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE 11: ⚠️ Limited (no CSS Grid)

## Performance

- Lazy rendering of off-screen items possible with max item cap
- Staggered animations improve perceived performance
- CSS transitions use GPU acceleration
- Minimal JavaScript calculations

## Future Enhancements

Potential additions:
- Grouping events by date/week
- Search/filter functionality
- Timeline branching (multiple parallel tracks)
- Event categorization with color coding
- Export timeline as image/PDF
- Real-time event streaming updates
