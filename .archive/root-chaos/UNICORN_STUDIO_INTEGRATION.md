# 🦄 Unicorn Studio Integration Guide

**Date**: 2026-02-16
**Status**: ✅ **Ready for Deployment**

---

## 📋 Overview

This guide covers the integration of **Unicorn Studio** interactive 3D/animation scenes into the Awareness Network website.

### What is Unicorn Studio?

Unicorn Studio is a tool for creating interactive 3D scenes and animations for websites. It provides:
- ✅ GPU-accelerated 3D graphics
- ✅ Interactive animations
- ✅ Lightweight runtime (~50KB gzipped)
- ✅ No WebGL knowledge required

---

## 📦 Components Created

### 1. UnicornScene Component
**Location**: `client/src/components/UnicornScene.tsx`

**Purpose**: Reusable wrapper for Unicorn Studio scenes

**Props**:
```tsx
interface UnicornSceneProps {
  projectId?: string;      // Unicorn Studio project ID
  width?: string;          // CSS width (default: '100%')
  height?: string;         // CSS height (default: '500px')
  className?: string;      // Additional CSS classes
}
```

**Usage**:
```tsx
import { UnicornScene } from './components/UnicornScene';

<UnicornScene
  projectId="DHrYV5fcnlpS1Vj341CH"
  width="100%"
  height="100vh"
  className="hero-background"
/>
```

---

### 2. HeroSection Component
**Location**: `client/src/components/HeroSection.tsx`

**Purpose**: Full-featured hero section with 3D background

**Features**:
- ✅ Unicorn Studio animated background
- ✅ High-contrast text overlay
- ✅ Gradient overlay for readability
- ✅ High Awareness UI design principles
- ✅ Responsive layout

**Props**:
```tsx
interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  showAnimation?: boolean;
}
```

**Usage**:
```tsx
import { HeroSection } from './components/HeroSection';

<HeroSection
  title="Awareness Network"
  subtitle="Next-Generation Robot Management"
  ctaText="Get Started"
  ctaHref="/robotics"
  showAnimation={true}
/>
```

---

### 3. LandingPage Component
**Location**: `client/src/pages/LandingPage.tsx`

**Purpose**: Complete marketing landing page

**Sections**:
1. **Hero** - Animated background with CTAs
2. **Features** - 3-column feature grid
3. **Tech Stack** - 8 technology showcases
4. **CTA** - Final conversion section
5. **Footer** - Credits and links

---

## 🎨 Design Principles Applied

### High Awareness UI Integration

All components follow the **High Awareness design system**:

#### 1. **High Contrast Text**
```tsx
// Large, bold numbers
<div className="text-6xl font-black text-gray-900 mb-4">125x</div>

// Bracketed status labels
<span className="px-4 py-2 bg-white text-gray-900 border-2 border-white">
  [PRODUCTION-READY]
</span>
```

#### 2. **Clear Visual Hierarchy**
```tsx
// Primary CTA - Highest contrast
<a className="bg-white text-gray-900 text-lg font-black border-4 border-white">
  ▶ Start Building
</a>

// Secondary CTA - Transparent with border
<a className="bg-transparent text-white border-2 border-white">
  View Documentation →
</a>
```

#### 3. **Readable on Animation**
- Gradient overlay: `bg-gradient-to-b from-gray-900/50`
- Z-index layering for proper stacking
- High contrast white text on dark background

---

## 🚀 Integration Steps

### Step 1: Install Components

All components are already created:
- ✅ `client/src/components/UnicornScene.tsx`
- ✅ `client/src/components/HeroSection.tsx`
- ✅ `client/src/pages/LandingPage.tsx`

### Step 2: Add to Router

Add the landing page to your React Router:

```tsx
// In your main router file (e.g., App.tsx)
import LandingPage from './pages/LandingPage';

<Route path="/" element={<LandingPage />} />
<Route path="/robotics" element={<RoboticsPage />} />
```

### Step 3: Verify Script Loading

The Unicorn Studio script is automatically loaded by `UnicornScene` component:
- URL: `https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js`
- Size: ~50KB gzipped
- Load: Async, non-blocking

---

## 🎯 Unicorn Studio Project Details

### Current Project

**Project ID**: `DHrYV5fcnlpS1Vj341CH`

This is embedded from your Webflow configuration.

### Customizing the Scene

To use a different Unicorn Studio scene:

1. Create your scene at [unicorn.studio](https://unicorn.studio)
2. Get your project ID
3. Update the `projectId` prop:

```tsx
<UnicornScene projectId="YOUR_PROJECT_ID_HERE" />
```

### Scene Performance

**Recommended Settings**:
- Target FPS: 60
- Max Particles: 1000
- GPU Acceleration: Enabled
- Mobile Optimization: Enabled

---

## 📐 Layout Examples

### Full-Page Hero
```tsx
<UnicornScene
  projectId="DHrYV5fcnlpS1Vj341CH"
  width="100%"
  height="100vh"
/>
```

### Section Background
```tsx
<section className="relative min-h-screen">
  <div className="absolute inset-0 z-0">
    <UnicornScene height="100%" />
  </div>
  <div className="relative z-10">
    {/* Your content */}
  </div>
</section>
```

### Card Background
```tsx
<div className="relative w-full h-96 rounded-lg overflow-hidden">
  <UnicornScene height="384px" />
</div>
```

---

## ⚡ Performance Optimization

### 1. Lazy Loading

For better performance, lazy load the scene:

```tsx
import React, { lazy, Suspense } from 'react';

const UnicornScene = lazy(() => import('./components/UnicornScene'));

function Hero() {
  return (
    <Suspense fallback={<div className="bg-gray-900 h-screen" />}>
      <UnicornScene />
    </Suspense>
  );
}
```

### 2. Conditional Loading

Only load on desktop:

```tsx
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  setIsMobile(window.innerWidth < 768);
}, []);

{!isMobile && <UnicornScene />}
```

### 3. Fallback Background

Provide a static fallback:

```tsx
<div className="relative">
  {showAnimation ? (
    <UnicornScene />
  ) : (
    <div className="bg-gradient-to-br from-gray-900 to-black h-screen" />
  )}
</div>
```

---

## 🎨 Customization Guide

### Color Overlay

Add a tinted overlay:

```tsx
<div className="absolute inset-0 bg-blue-900/30 pointer-events-none z-[5]" />
```

### Animation Speed

Control via CSS:

```css
.unicorn-scene {
  animation-duration: 2s;
  transition: all 0.3s ease;
}
```

### Interactive Elements

Add clickable hotspots:

```tsx
<div className="relative">
  <UnicornScene />
  <button className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
    Click Me
  </button>
</div>
```

---

## 🔧 Troubleshooting

### Scene Not Loading

**Check**:
1. ✅ Project ID is correct
2. ✅ Internet connection available
3. ✅ Script loaded (check browser console)
4. ✅ No ad blockers interfering

**Debug**:
```tsx
useEffect(() => {
  console.log('Unicorn Studio:', window.UnicornStudio);
}, []);
```

### Performance Issues

**Solutions**:
1. Enable mobile optimization in Unicorn Studio
2. Reduce particle count
3. Lower target FPS to 30 on mobile
4. Use lazy loading

### Z-Index Conflicts

**Fix layering**:
```tsx
<div className="relative">
  <div className="absolute inset-0 z-0">
    <UnicornScene /> {/* Background */}
  </div>
  <div className="relative z-10">
    {/* Content always on top */}
  </div>
</div>
```

---

## 📊 Feature Comparison

| Feature | Static Background | Unicorn Studio | Advantage |
|---------|-------------------|----------------|-----------|
| **File Size** | ~500KB (image) | ~50KB (runtime) | ✅ Smaller |
| **Interactivity** | None | Full 3D | ✅ Engaging |
| **GPU Acceleration** | No | Yes | ✅ Smooth |
| **Customization** | Limited | Extensive | ✅ Flexible |
| **Load Time** | Immediate | ~1-2s | ⚠️ Delayed |
| **Mobile Support** | Perfect | Good | ⚠️ Battery |

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices (iOS, Android)
- [ ] Verify performance (60fps on desktop, 30fps on mobile)
- [ ] Check accessibility (keyboard navigation, screen readers)
- [ ] Test with slow 3G connection
- [ ] Verify fallback for browsers without WebGL
- [ ] Add error boundaries
- [ ] Configure CSP headers if needed
- [ ] Test with ad blockers enabled
- [ ] Verify analytics tracking

---

## 📚 Additional Resources

- [Unicorn Studio Documentation](https://docs.unicorn.studio)
- [High Awareness UI Design](./UI_AWARENESS_DESIGN.md)
- [Frontend Implementation](./FRONTEND_IMPLEMENTATION.md)

---

## ✅ Summary

You now have:
- ✅ Reusable `UnicornScene` component
- ✅ Production-ready `HeroSection` with animation
- ✅ Complete `LandingPage` template
- ✅ High Awareness design integration
- ✅ Performance optimization guide
- ✅ Troubleshooting documentation

**Your Unicorn Studio scene is ready to deploy!** 🦄✨

---

**Maintained by**: Awareness Network Frontend Team
**Last Updated**: 2026-02-16
