// Type declarations for @mui/icons-material
declare module '@mui/icons-material' {
  import { SvgIconProps } from '@mui/material/SvgIcon';
  import { ComponentType } from 'react';

  export const Dashboard: ComponentType<SvgIconProps>;
  export const People: ComponentType<SvgIconProps>;
  export const Description: ComponentType<SvgIconProps>;
  export const Medication: ComponentType<SvgIconProps>;
  export const Assessment: ComponentType<SvgIconProps>;
  export const CreditCard: ComponentType<SvgIconProps>;
  export const Settings: ComponentType<SvgIconProps>;
  export const Help: ComponentType<SvgIconProps>;
  export const ChevronLeft: ComponentType<SvgIconProps>;
  export const TrendingUp: ComponentType<SvgIconProps>;
  export const Warning: ComponentType<SvgIconProps>;
  export const Schedule: ComponentType<SvgIconProps>;
  export const MoreHoriz: ComponentType<SvgIconProps>;
  export const Add: ComponentType<SvgIconProps>;
  export const Notifications: ComponentType<SvgIconProps>;
  export const CalendarToday: ComponentType<SvgIconProps>;
  export const Timeline: ComponentType<SvgIconProps>;
  export const Event: ComponentType<SvgIconProps>;
  export const AccessTime: ComponentType<SvgIconProps>;
  
  // Add more icons as needed
  const icons: { [key: string]: ComponentType<SvgIconProps> };
  export default icons;
}