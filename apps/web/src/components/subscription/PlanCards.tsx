import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Star as StarIcon,
  Bolt as BoltIcon,
  Stars as StarsIcon,
} from '@mui/icons-material';

interface Plan {
  name: string;
  price: string;
  description: string;
  popular: boolean;
  features: string[];
  notIncluded: string[];
  actionText?: string;
  onSelectPlan?: () => void;
}

interface PlanCardsProps {
  plans: Plan[];
}

const PlanCards: React.FC<PlanCardsProps> = ({ plans }) => {
  return (
    <Grid container spacing={4} justifyContent="center">
      {plans.map((plan, index) => (
        <Grid item xs={12} md={4} key={index}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              border: plan.popular ? 2 : 1,
              borderColor: plan.popular ? 'primary.main' : 'grey.200',
              transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: plan.popular ? 'scale(1.05)' : 'scale(1.02)',
                boxShadow: plan.popular ? 6 : 4,
              },
            }}
          >
            {plan.popular && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -1,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: 'primary.main',
                  color: 'white',
                  px: 3,
                  py: 0.5,
                  borderRadius: '0 0 12px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <StarIcon fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Most Popular
                </Typography>
              </Box>
            )}

            <CardContent
              sx={{
                p: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  {plan.name === 'Enterprise' ? (
                    <StarsIcon
                      sx={{ fontSize: 32, color: 'warning.main', mr: 1 }}
                    />
                  ) : (
                    <BoltIcon
                      sx={{ fontSize: 32, color: 'primary.main', mr: 1 }}
                    />
                  )}
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {plan.name}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  {plan.description}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="h3"
                    sx={{ fontWeight: 700, color: 'primary.main' }}
                  >
                    ₦{plan.price}
                  </Typography>
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    /month
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Billed monthly
                </Typography>
              </Box>

              <Button
                variant={plan.popular ? 'contained' : 'outlined'}
                size="large"
                fullWidth
                sx={{
                  mb: 4,
                  py: 1.5,
                  borderRadius: 3,
                  textTransform: 'none',
                  fontWeight: 600,
                }}
                onClick={plan.onSelectPlan}
              >
                {plan.actionText ||
                  (plan.popular ? 'Start Free Trial' : 'Get Started')}
              </Button>

              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  What's included:
                </Typography>
                <List disablePadding>
                  {plan.features.map((feature, featureIndex) => (
                    <ListItem
                      key={featureIndex}
                      disablePadding
                      sx={{ py: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckIcon
                          sx={{ fontSize: 20, color: 'success.main' }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={feature}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                  {plan.notIncluded.map((feature, featureIndex) => (
                    <ListItem
                      key={featureIndex}
                      disablePadding
                      sx={{ py: 0.5, opacity: 0.6 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CloseIcon
                          sx={{ fontSize: 20, color: 'text.disabled' }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={feature}
                        primaryTypographyProps={{
                          variant: 'body2',
                          color: 'text.secondary',
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default PlanCards;
