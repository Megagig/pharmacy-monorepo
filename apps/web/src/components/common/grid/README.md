# Material UI v7 Grid TypeScript Solution

This solution addresses the TypeScript errors related to Material UI v7 Grid components that occur when combining `component="div"` with `item` or `container` props.

## The Problem

In Material UI v7, the Grid component has typing issues that cause TypeScript errors when:

1. Using `item` prop with `component="div"`
2. Using `container` prop with type props like `spacing`, `alignItems`, etc.

These errors occur even though the component works correctly at runtime.

## The Solution

This package provides wrapper components that handle the type casting internally:

1. `GridItem` - A wrapper for `<Grid item ...>`
2. `GridContainer` - A wrapper for `<Grid container ...>`

## How to Use

### 1. Import the Components

```tsx
// Import individually
import { GridItem, GridContainer } from '../components/common/grid';

// Or import from the index
import * as Grid from '../components/common/grid';
```

### 2. Replace Grid Components

#### Before (with TypeScript errors):

```tsx
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    {/* content */}
  </Grid>
</Grid>
```

#### After (TypeScript-friendly):

```tsx
<GridContainer spacing={2}>
  <GridItem xs={12} md={6}>
    {/* content */}
  </GridItem>
</GridContainer>
```

## Features

- All common Grid props are supported and properly typed
- No need for `@ts-expect-error` or type assertions in your components
- Clean, readable code
- Same behavior and style as Material UI Grid

## Props Reference

### GridContainer Props

- `spacing`: number - Sets the spacing between grid items
- `alignItems`: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
- `justifyContent`: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
- `direction`: 'row' | 'row-reverse' | 'column' | 'column-reverse'
- `sx`: styling object for Material UI's sx prop
- Other common props: style, className, etc.

### GridItem Props

- `xs`, `sm`, `md`, `lg`, `xl`: number | boolean - Responsive sizing
- `sx`: styling object
- Other common props: style, className, onClick, etc.

## Example

See `GridExample.tsx` for a complete working example.

## Best Practices

1. Always use `GridContainer` instead of `<Grid container>`
2. Always use `GridItem` instead of `<Grid item>`
3. For nested grids, use `GridContainer` inside a `GridItem`

## Additional Resources

- [Material UI Grid documentation](https://mui.com/components/grid/)
- [Flexbox guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
