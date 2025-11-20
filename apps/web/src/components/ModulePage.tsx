import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Container,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type { ModulePageProps } from '../types/moduleTypes';

const ModulePage: React.FC<ModulePageProps> = ({
  moduleInfo,
  icon: IconComponent,
  gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  children,
  hideModuleInfo = false,
}) => {
  // No need for navigation function since we're not using it

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      {/* Module Header */}
      <Box
        sx={{
          p: 3,
          borderRadius: '12px',
          background: gradient,
          color: 'white',
          mb: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {IconComponent && <IconComponent sx={{ fontSize: 32 }} />}
          </Box>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              {moduleInfo.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
              {moduleInfo.purpose}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Module Information Section */}
      {!hideModuleInfo && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Box
            sx={{
              flex: '1 1 45%',
              minWidth: '300px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Workflow Section */}
            <Card
              sx={{
                height: 'fit-content',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      background:
                        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ScheduleIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Typography
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 600, color: 'text.primary' }}
                  >
                    Workflow
                  </Typography>
                </Box>

                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mb: 3, lineHeight: 1.6 }}
                >
                  {moduleInfo.workflow.description}
                </Typography>

                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 2,
                    color: 'text.primary',
                  }}
                >
                  Process Steps:
                </Typography>

                <List sx={{ mb: 0, p: 0 }}>
                  {moduleInfo.workflow.steps.map((step, index) => (
                    <ListItem
                      key={index}
                      sx={{
                        p: 0,
                        '& + &': { mt: 2 },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                        }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                          }}
                        >
                          {index + 1}
                        </Box>
                      </ListItemIcon>
                      <ListItemText primary={step} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Box>
          
          <Box
            sx={{
              flex: '1 1 45%',
              minWidth: '300px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Key Features Section */}
            <Card
              sx={{
                height: 'fit-content',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      background:
                        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircleIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Typography
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 600, color: 'text.primary' }}
                  >
                    Key Features
                  </Typography>
                </Box>

                <List sx={{ p: 0 }}>
                  {moduleInfo.keyFeatures.map((feature, index) => (
                    <ListItem
                      key={index}
                      sx={{
                        p: 0,
                        mb: 2,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                          mt: 0,
                        }}
                      >
                        <CheckCircleIcon
                          color="success"
                          fontSize="small"
                          sx={{ mt: 0.25 }}
                        />
                      </ListItemIcon>
                      <ListItemText primary={feature} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Main Content Section */}
      <Box mt={hideModuleInfo ? 0 : 4}>{children}</Box>
    </Container>
  );
};

export default ModulePage;
