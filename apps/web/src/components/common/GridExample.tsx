import React from 'react';
import { TextField, Button, Typography, Paper } from '@mui/material';
import { GridItem, GridContainer } from './GridSystem';

/**
 * Example component that demonstrates how to use the GridSystem components
 */
export const GridExample: React.FC = () => {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Grid System Example
      </Typography>

      <GridContainer spacing={3}>
        {/* Full width on xs, half width on md and up */}
        <GridItem xs={12} md={6}>
          <TextField
            fullWidth
            label="First Name"
            placeholder="Enter your first name"
          />
        </GridItem>

        {/* Full width on xs, half width on md and up */}
        <GridItem xs={12} md={6}>
          <TextField
            fullWidth
            label="Last Name"
            placeholder="Enter your last name"
          />
        </GridItem>

        {/* Full width */}
        <GridItem xs={12}>
          <TextField fullWidth label="Email" placeholder="Enter your email" />
        </GridItem>

        {/* Nested grid example */}
        <GridItem xs={12}>
          <GridContainer spacing={2}>
            <GridItem xs={12} md={4}>
              <TextField fullWidth label="City" placeholder="Enter your city" />
            </GridItem>
            <GridItem xs={12} md={4}>
              <TextField
                fullWidth
                label="State"
                placeholder="Enter your state"
              />
            </GridItem>
            <GridItem xs={12} md={4}>
              <TextField
                fullWidth
                label="Zip Code"
                placeholder="Enter your zip code"
              />
            </GridItem>
          </GridContainer>
        </GridItem>

        {/* Button row */}
        <GridItem xs={12}>
          <GridContainer spacing={2} justifyContent="flex-end">
            <GridItem>
              <Button variant="outlined">Cancel</Button>
            </GridItem>
            <GridItem>
              <Button variant="contained" color="primary">
                Submit
              </Button>
            </GridItem>
          </GridContainer>
        </GridItem>
      </GridContainer>
    </Paper>
  );
};

export default GridExample;
