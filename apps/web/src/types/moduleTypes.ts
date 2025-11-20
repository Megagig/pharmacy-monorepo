// TypeScript interfaces for pharmacy module data structure

export interface ModuleInfo {
  title: string;
  purpose: string;
  workflow: {
    steps: string[];
    description: string;
  };
  keyFeatures: string[];
  status: 'placeholder' | 'in_development' | 'active';
  estimatedRelease?: string;
}

export interface PharmacyModule {
  name: string;
  path: string;
  icon: React.ComponentType<{ sx?: React.CSSProperties; fontSize?: string }>;
  show: boolean;
  badge?: string | null;
  moduleInfo: ModuleInfo;
  gradient?: string;
}

export interface ModulePageProps {
  moduleInfo: ModuleInfo;
  icon: React.ComponentType<{ sx?: React.CSSProperties; fontSize?: string }>;
  gradient?: string;
  children?: React.ReactNode;
  hideModuleInfo?: boolean;
}
