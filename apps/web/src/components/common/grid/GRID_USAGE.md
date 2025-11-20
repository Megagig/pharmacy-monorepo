# Using the GridSystem Component

This document provides guidance on how to use the `GridSystem` component that fixes Material UI v7 Grid typing issues.

## Problem

Material UI v7 has typing issues with its Grid component, especially when using `component="div"` and `item` props together. This causes TypeScript errors in components that use MUI Grid.

## Solution

We've created wrapper components that handle the type casting internally to avoid cluttering your component code with `@ts-expect-error` comments or type assertions.

## How to Use

### Import

First, import the GridItem and GridContainer components:

```tsx
import { GridItem, GridContainer } from '../common/GridSystem';
```

### Replace Grid components

Replace your MUI Grid components with our wrapper components:

#### Before

```tsx
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    {/* content */}
  </Grid>
</Grid>
```

#### After

```tsx
<GridContainer spacing={2}>
  <GridItem xs={12} md={6}>
    {/* content */}
  </GridItem>
</GridContainer>
```

### Supported Props

The wrapper components support all common Grid props:

#### GridContainer Props

- spacing
- alignItems
- justifyContent
- direction
- sx
- style
- className
- (and other standard props)

#### GridItem Props

- xs, sm, md, lg, xl (responsive sizing)
- sx
- spacing
- style
- className
- onClick and other event handlers
- (and other standard props)

## Example

```tsx
<GridContainer spacing={3} sx={{ mt: 2 }}>
  <GridItem xs={12} md={6}>
    <TextField fullWidth label="Name" />
  </GridItem>
  <GridItem xs={12} md={6}>
    <TextField fullWidth label="Email" />
  </GridItem>
  <GridItem xs={12}>
    <Button variant="contained">Submit</Button>
  </GridItem>
</GridContainer>
```

## Benefits

- No more TypeScript errors with Material UI v7 Grid components
- Clean code without type assertions or suppress comments
- Full type support for props
- Same functionality as MUI Grid
