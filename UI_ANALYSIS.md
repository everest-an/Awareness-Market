# Awareness Network - UI Design Analysis

## Visual Design System

### Color Scheme
- **Background**: Pure black (#000000) - Dark theme
- **Primary Text**: White (#FFFFFF)
- **Secondary Text**: Gray (#808080 or similar)
- **Accent Color**: Gradient buttons with pink/purple tones
- **Card Background**: Dark gray (#1a1a1a or similar)
- **Border**: Subtle borders with gradient effects

### Typography
- **Heading Font**: Large, bold, modern sans-serif
- **Body Font**: Clean sans-serif, medium weight
- **Font Sizes**: 
  - Hero title: Very large (60-80px)
  - Section headings: Large (32-40px)
  - Body text: Medium (16-18px)
  - Descriptions: Small (14-16px)

### Layout Structure
- **Hero Section**: Centered layout with large title and subtitle
- **Feature Cards**: Grid layout (2 columns) with icon, title, description, and CTA button
- **Spacing**: Generous padding and margins
- **Alignment**: Center-aligned for hero, left-aligned for cards

### Component Styles

**Cards**:
- Dark background with subtle border
- Rounded corners (medium radius, ~12-16px)
- Icon at top (brain icon, people icon)
- Title in white
- Description in gray
- Gradient button at bottom with arrow icon
- Hover effects with glow/border animation

**Buttons**:
- Gradient background (pink to purple)
- White text
- Rounded corners
- Arrow icon (→)
- Hover effects with brightness increase
- Border glow effect

**Icons**:
- Line-style icons
- White color
- Large size (48-64px)
- Simple, minimal design

### Key Features Section
- Grid layout (2x2)
- Checkmark icons
- Feature title in white
- Description in gray
- Dark card backgrounds
- Consistent spacing

### Visual Effects
- Subtle gradients on buttons
- Border glow effects
- Smooth hover transitions
- Card shadows (subtle)
- Background: Pure black, no texture

### Design Philosophy
- **Minimalist**: Clean, uncluttered design
- **Modern**: Contemporary UI patterns
- **Tech-focused**: Dark theme, gradient accents
- **Professional**: High contrast, clear hierarchy
- **Spacious**: Generous white space

## Implementation Notes

### Tailwind CSS Configuration Needed
```css
colors: {
  background: '#000000',
  foreground: '#ffffff',
  card: '#1a1a1a',
  'card-foreground': '#ffffff',
  muted: '#808080',
  accent: {
    from: '#ec4899', // pink
    to: '#8b5cf6',   // purple
  }
}

borderRadius: {
  card: '12px',
  button: '8px',
}
```

### Component Patterns
1. Hero section with centered content
2. Feature cards with icon-title-description-CTA structure
3. Gradient buttons with hover effects
4. Grid layouts for feature sections
5. Consistent spacing system (multiples of 4 or 8)

### Animation/Interaction
- Smooth transitions (0.3s ease)
- Hover state: brightness increase, border glow
- Button hover: scale slightly, increase glow
- Card hover: subtle lift effect

---

This design system emphasizes a dark, modern, tech-focused aesthetic with clean typography, generous spacing, and gradient accent colors for CTAs.
