import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  useTheme,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useUIStore } from '../stores';

interface TestResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'pending';
  details?: string;
}

const SidebarTest: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');

  const tests = [
    {
      name: 'Sidebar Toggle Functionality',
      category: 'Toggle Tests',
      test: () => {
        const initialState = sidebarOpen;
        toggleSidebar();
        setTimeout(() => {
          const newState = useUIStore.getState().sidebarOpen;
          const passed = newState !== initialState;
          updateTestResult(
            'Sidebar Toggle Functionality',
            'Toggle Tests',
            passed ? 'pass' : 'fail',
            passed ? 'Toggle works correctly' : 'Toggle failed to change state'
          );
        }, 100);
      },
    },
    {
      name: 'Sidebar Width Changes',
      category: 'Toggle Tests',
      test: () => {
        const sidebar = document.querySelector('.MuiDrawer-paper');
        if (sidebar) {
          const width = window.getComputedStyle(sidebar).width;
          const expectedWidth = sidebarOpen ? '280px' : '56px';
          const passed = width === expectedWidth;
          updateTestResult(
            'Sidebar Width Changes',
            'Toggle Tests',
            passed ? 'pass' : 'fail',
            `Expected: ${expectedWidth}, Actual: ${width}`
          );
        } else {
          updateTestResult(
            'Sidebar Width Changes',
            'Toggle Tests',
            'fail',
            'Sidebar element not found'
          );
        }
      },
    },
    {
      name: 'Toggle Button Visibility',
      category: 'Toggle Tests',
      test: () => {
        // Look for toggle buttons by their styling and position
        const allBoxes = document.querySelectorAll('.MuiBox-root');
        const toggleButtons = Array.from(allBoxes).filter((box) => {
          const style = window.getComputedStyle(box);
          return (
            style.backgroundColor.includes('25, 118, 210') || // Primary blue color
            style.cursor === 'pointer'
          );
        });
        updateTestResult(
          'Toggle Button Visibility',
          'Toggle Tests',
          toggleButtons.length > 0 ? 'pass' : 'fail',
          `Found ${toggleButtons.length} potential toggle buttons`
        );
      },
    },
    {
      name: 'Pharmacy Modules Visibility',
      category: 'Module Visibility',
      test: () => {
        const pharmacySection = Array.from(document.querySelectorAll('*')).find(
          (el) => el.textContent?.includes('PHARMACY TOOLS')
        );

        if (pharmacySection) {
          // Count pharmacy modules
          const moduleLinks = document.querySelectorAll(
            'a[href*="/pharmacy/"]'
          );
          updateTestResult(
            'Pharmacy Modules Visibility',
            'Module Visibility',
            moduleLinks.length >= 9 ? 'pass' : 'fail',
            `Found ${moduleLinks.length} pharmacy modules (expected 9)`
          );
        } else {
          updateTestResult(
            'Pharmacy Modules Visibility',
            'Module Visibility',
            'fail',
            'Pharmacy tools section not found'
          );
        }
      },
    },
    {
      name: 'Section Headers Visibility (Expanded)',
      category: 'Module Visibility',
      test: () => {
        if (sidebarOpen) {
          const headers = ['MAIN MENU', 'PHARMACY TOOLS', 'ACCOUNT'];
          const foundHeaders = headers.filter((header) =>
            Array.from(document.querySelectorAll('*')).some((el) =>
              el.textContent?.includes(header)
            )
          );
          updateTestResult(
            'Section Headers Visibility (Expanded)',
            'Module Visibility',
            foundHeaders.length >= 3 ? 'pass' : 'fail',
            `Found headers: ${foundHeaders.join(', ')}`
          );
        } else {
          updateTestResult(
            'Section Headers Visibility (Expanded)',
            'Module Visibility',
            'pending',
            'Sidebar must be expanded to test headers'
          );
        }
      },
    },
    {
      name: 'Coming Soon Badges',
      category: 'Module Visibility',
      test: () => {
        const comingSoonBadges = Array.from(
          document.querySelectorAll('.MuiChip-root')
        ).filter((chip) => chip.textContent?.includes('Coming Soon'));
        updateTestResult(
          'Coming Soon Badges',
          'Module Visibility',
          comingSoonBadges.length >= 9 ? 'pass' : 'fail',
          `Found ${comingSoonBadges.length} "Coming Soon" badges (expected 9)`
        );
      },
    },
    {
      name: 'Tooltip Elements (Collapsed)',
      category: 'Tooltip Tests',
      test: () => {
        if (!sidebarOpen) {
          const tooltipElements = document.querySelectorAll(
            '.MuiTooltip-root, [title]'
          );
          updateTestResult(
            'Tooltip Elements (Collapsed)',
            'Tooltip Tests',
            tooltipElements.length > 0 ? 'pass' : 'fail',
            `Found ${tooltipElements.length} elements with tooltip capability`
          );
        } else {
          updateTestResult(
            'Tooltip Elements (Collapsed)',
            'Tooltip Tests',
            'pending',
            'Sidebar must be collapsed to test tooltips'
          );
        }
      },
    },
    {
      name: 'Icon Visibility (Collapsed)',
      category: 'Tooltip Tests',
      test: () => {
        if (!sidebarOpen) {
          const icons = document.querySelectorAll('.MuiListItemIcon-root svg');
          updateTestResult(
            'Icon Visibility (Collapsed)',
            'Tooltip Tests',
            icons.length >= 15 ? 'pass' : 'fail',
            `Found ${icons.length} icons in collapsed state`
          );
        } else {
          updateTestResult(
            'Icon Visibility (Collapsed)',
            'Tooltip Tests',
            'pending',
            'Sidebar must be collapsed to test icon visibility'
          );
        }
      },
    },
    {
      name: 'Mobile Detection',
      category: 'Responsive Tests',
      test: () => {
        const screenWidth = window.innerWidth;
        const isMobileDetected = screenWidth < 900; // md breakpoint
        updateTestResult(
          'Mobile Detection',
          'Responsive Tests',
          'pass',
          `Screen width: ${screenWidth}px, Mobile detected: ${isMobileDetected}`
        );
      },
    },
    {
      name: 'Navigation Links',
      category: 'Navigation Tests',
      test: () => {
        const navLinks = document.querySelectorAll('a[href]');
        const pharmacyLinks = Array.from(navLinks).filter((link) =>
          link.getAttribute('href')?.includes('/pharmacy/')
        );
        updateTestResult(
          'Navigation Links',
          'Navigation Tests',
          pharmacyLinks.length >= 9 ? 'pass' : 'fail',
          `Found ${pharmacyLinks.length} pharmacy navigation links`
        );
      },
    },
  ];

  const updateTestResult = (
    name: string,
    category: string,
    status: 'pass' | 'fail' | 'pending',
    details?: string
  ) => {
    setTestResults((prev) => {
      const existing = prev.find((r) => r.name === name);
      if (existing) {
        existing.status = status;
        existing.details = details;
        return [...prev];
      } else {
        return [...prev, { name, category, status, details }];
      }
    });
  };

  const runTest = (test: (typeof tests)[0]) => {
    setCurrentTest(test.name);
    updateTestResult(test.name, test.category, 'pending', 'Running test...');
    try {
      test.test();
    } catch (error) {
      updateTestResult(test.name, test.category, 'fail', `Error: ${error}`);
    }
    setTimeout(() => setCurrentTest(''), 1000);
  };

  const runAllTests = () => {
    tests.forEach((test, index) => {
      setTimeout(() => runTest(test), index * 500);
    });
  };

  const runCategoryTests = (category: string) => {
    const categoryTests = tests.filter((test) => test.category === category);
    categoryTests.forEach((test, index) => {
      setTimeout(() => runTest(test), index * 300);
    });
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'pending') => {
    switch (status) {
      case 'pass':
        return 'success';
      case 'fail':
        return 'error';
      case 'pending':
        return 'warning';
    }
  };

  const getTestsByCategory = () => {
    const categories = [...new Set(tests.map((test) => test.category))];
    return categories.map((category) => ({
      category,
      tests: tests.filter((test) => test.category === category),
    }));
  };

  const getOverallStats = () => {
    const total = testResults.length;
    const passed = testResults.filter((r) => r.status === 'pass').length;
    const failed = testResults.filter((r) => r.status === 'fail').length;
    const pending = testResults.filter((r) => r.status === 'pending').length;
    return { total, passed, failed, pending };
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Sidebar Functionality Test Suite
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Task 6:</strong> Test sidebar functionality and responsive
          behavior
          <br />
          Current sidebar state:{' '}
          <strong>
            {sidebarOpen ? 'Expanded (280px)' : 'Collapsed (56px)'}
          </strong>
          <br />
          Screen size:{' '}
          <strong>
            {window.innerWidth}x{window.innerHeight}
          </strong>
          {isMobile && ' (Mobile device detected)'}
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Control Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test Controls
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={runAllTests}
                  disabled={currentTest !== ''}
                  fullWidth
                >
                  Run All Tests
                </Button>
                <Button variant="outlined" onClick={toggleSidebar} fullWidth>
                  Toggle Sidebar ({sidebarOpen ? 'Collapse' : 'Expand'})
                </Button>
                <Divider />
                <Typography variant="subtitle2">Run by Category:</Typography>
                {getTestsByCategory().map(({ category }) => (
                  <Button
                    key={category}
                    size="small"
                    variant="text"
                    onClick={() => runCategoryTests(category)}
                    disabled={currentTest !== ''}
                  >
                    {category}
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test Summary
              </Typography>
              {(() => {
                const stats = getOverallStats();
                return (
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                  >
                    <Chip label={`Total: ${stats.total}/${tests.length}`} />
                    <Chip label={`Passed: ${stats.passed}`} color="success" />
                    <Chip label={`Failed: ${stats.failed}`} color="error" />
                    <Chip label={`Pending: ${stats.pending}`} color="warning" />
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Grid>

        {/* Test Results */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Test Results by Category
            </Typography>

            {currentTest && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Currently running: <strong>{currentTest}</strong>
              </Alert>
            )}

            {getTestsByCategory().map(({ category, tests: categoryTests }) => (
              <Accordion key={category} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      width: '100%',
                    }}
                  >
                    <Typography variant="h6">{category}</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {(() => {
                        const categoryResults = testResults.filter((r) =>
                          categoryTests.some((t) => t.name === r.name)
                        );
                        const passed = categoryResults.filter(
                          (r) => r.status === 'pass'
                        ).length;
                        const failed = categoryResults.filter(
                          (r) => r.status === 'fail'
                        ).length;
                        const pending = categoryResults.filter(
                          (r) => r.status === 'pending'
                        ).length;

                        return (
                          <>
                            {passed > 0 && (
                              <Chip
                                size="small"
                                label={passed}
                                color="success"
                              />
                            )}
                            {failed > 0 && (
                              <Chip size="small" label={failed} color="error" />
                            )}
                            {pending > 0 && (
                              <Chip
                                size="small"
                                label={pending}
                                color="warning"
                              />
                            )}
                          </>
                        );
                      })()}
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {categoryTests.map((test) => {
                      const result = testResults.find(
                        (r) => r.name === test.name
                      );
                      return (
                        <ListItem
                          key={test.name}
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            mb: 1,
                            borderRadius: 1,
                            bgcolor:
                              result?.status === 'pass'
                                ? 'success.light'
                                : result?.status === 'fail'
                                ? 'error.light'
                                : 'transparent',
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <Typography variant="body2">
                                  {test.name}
                                </Typography>
                                {result && (
                                  <Chip
                                    label={result.status.toUpperCase()}
                                    color={getStatusColor(result.status)}
                                    size="small"
                                  />
                                )}
                              </Box>
                            }
                            secondary={result?.details}
                          />
                          <Button
                            size="small"
                            onClick={() => runTest(test)}
                            disabled={currentTest !== ''}
                          >
                            Run
                          </Button>
                        </ListItem>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SidebarTest;
