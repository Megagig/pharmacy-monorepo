import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ApiIntegrations from '../ApiIntegrations';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ApiIntegrations', () => {
  it('should render the component', () => {
    renderWithTheme(<ApiIntegrations />);
    
    expect(screen.getByText('API & Integrations')).toBeInTheDocument();
  });

  it('should display under development message', () => {
    renderWithTheme(<ApiIntegrations />);
    
    expect(screen.getByText(/This section is under development/)).toBeInTheDocument();
    expect(screen.getByText(/Advanced API and integration features will be available soon/)).toBeInTheDocument();
  });

  it('should display construction icon', () => {
    renderWithTheme(<ApiIntegrations />);
    
    const constructionIcon = screen.getByTestId('ConstructionIcon');
    expect(constructionIcon).toBeInTheDocument();
  });

  it('should display disabled coming soon button', () => {
    renderWithTheme(<ApiIntegrations />);
    
    const button = screen.getByRole('button', { name: /coming soon/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('should have proper styling structure', () => {
    renderWithTheme(<ApiIntegrations />);
    
    const card = screen.getByText('API & Integrations').closest('.MuiCard-root');
    expect(card).toBeInTheDocument();
    
    const cardContent = screen.getByText('API & Integrations').closest('.MuiCardContent-root');
    expect(cardContent).toBeInTheDocument();
  });

  it('should display heading with correct variant', () => {
    renderWithTheme(<ApiIntegrations />);
    
    const heading = screen.getByRole('heading', { level: 4 });
    expect(heading).toHaveTextContent('API & Integrations');
  });

  it('should have accessible structure', () => {
    renderWithTheme(<ApiIntegrations />);
    
    // Check for proper heading hierarchy
    const heading = screen.getByRole('heading', { level: 4 });
    expect(heading).toBeInTheDocument();
    
    // Check for button accessibility
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});