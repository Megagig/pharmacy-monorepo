// Chart Types and Configurations

export type ChartType =
    | 'line'
    | 'area'
    | 'bar'
    | 'column'
    | 'pie'
    | 'donut'
    | 'scatter'
    | 'bubble'
    | 'heatmap'
    | 'treemap'
    | 'funnel'
    | 'gauge'
    | 'radar'
    | 'sankey'
    | 'waterfall'
    | 'candlestick'
    | 'kpi-card'
    | 'progress-ring';

export interface ChartData {
    id: string;
    title: string;
    subtitle?: string;
    type: ChartType;
    data: DataPoint[];
    config: ChartConfig;
    loading?: boolean;
    error?: string;
}

export interface DataPoint {
    [key: string]: string | number | Date | boolean;
}

export interface ChartConfig {
    title: ChartTitle;
    axes: AxesConfig;
    series: SeriesConfig[];
    legend: LegendConfig;
    tooltip: TooltipConfig;
    annotations: AnnotationConfig[];
    interactions: InteractionConfig;
    theme: ChartTheme;
    animations: AnimationConfig;
    responsive: ResponsiveConfig;
}

export interface ChartTitle {
    text: string;
    subtitle?: string;
    alignment: 'left' | 'center' | 'right';
    style: TextStyle;
}

export interface TextStyle {
    fontSize: number;
    fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontFamily?: string;
    color: string;
    lineHeight?: number;
}

export interface AxesConfig {
    x: AxisConfig;
    y: AxisConfig;
    y2?: AxisConfig; // Secondary Y-axis
}

export interface AxisConfig {
    label: string;
    type: 'category' | 'number' | 'time' | 'log';
    domain?: [number, number] | 'auto';
    tickCount?: number;
    tickFormat?: string;
    grid: boolean;
    style: AxisStyle;
}

export interface AxisStyle {
    lineColor: string;
    tickColor: string;
    labelStyle: TextStyle;
    gridStyle: {
        strokeDasharray?: string;
        opacity: number;
        color: string;
    };
}

export interface SeriesConfig {
    name: string;
    type: ChartType;
    dataKey: string;
    data?: DataPoint[];
    style: SeriesStyle;
    animations: SeriesAnimation;
    yAxisId?: 'left' | 'right';
}

export interface SeriesStyle {
    color: string;
    gradient?: GradientConfig;
    strokeWidth?: number;
    fillOpacity?: number;
    pattern?: PatternConfig;
    marker?: MarkerConfig;
}

export interface GradientConfig {
    type: 'linear' | 'radial';
    stops: ColorStop[];
    direction?: number; // degrees for linear gradients
}

export interface ColorStop {
    offset: number; // 0-1
    color: string;
    opacity?: number;
}

export interface PatternConfig {
    type: 'dots' | 'lines' | 'crosshatch' | 'diagonal';
    size: number;
    color: string;
    opacity: number;
}

export interface MarkerConfig {
    enabled: boolean;
    shape: 'circle' | 'square' | 'triangle' | 'diamond';
    size: number;
    strokeWidth: number;
    strokeColor: string;
    fillColor: string;
}

export interface SeriesAnimation {
    enabled: boolean;
    duration: number;
    delay: number;
    easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

export interface LegendConfig {
    enabled: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
    alignment: 'start' | 'center' | 'end';
    style: LegendStyle;
}

export interface LegendStyle {
    fontSize: number;
    fontWeight: string;
    color: string;
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
}

export interface TooltipConfig {
    enabled: boolean;
    shared: boolean;
    formatter?: (value: any, name: string, props: any) => [string, string];
    labelFormatter?: (label: string) => string;
    style: TooltipStyle;
}

export interface TooltipStyle {
    backgroundColor: string;
    borderColor: string;
    borderRadius: number;
    boxShadow: string;
    fontSize: number;
    color: string;
    padding: number;
}

export interface AnnotationConfig {
    type: 'line' | 'area' | 'text' | 'arrow';
    value: number | string;
    axis: 'x' | 'y';
    label?: string;
    style: AnnotationStyle;
}

export interface AnnotationStyle {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    fill?: string;
    fillOpacity?: number;
    fontSize?: number;
    fontColor?: string;
}

export interface InteractionConfig {
    hover: boolean;
    click: boolean;
    zoom: boolean;
    pan: boolean;
    brush: boolean;
    crossfilter: boolean;
}

export interface ChartTheme {
    name: string;
    colorPalette: string[];
    gradients: GradientConfig[];
    typography: TypographyConfig;
    spacing: SpacingConfig;
    borderRadius: number;
    shadows: ShadowConfig;
    mode: 'light' | 'dark';
}

export interface TypographyConfig {
    fontFamily: string;
    fontSize: {
        small: number;
        medium: number;
        large: number;
        xlarge: number;
    };
    fontWeight: {
        light: number;
        normal: number;
        medium: number;
        bold: number;
    };
}

export interface SpacingConfig {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
}

export interface ShadowConfig {
    small: string;
    medium: string;
    large: string;
}

export interface AnimationConfig {
    duration: number;
    easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
    stagger: boolean;
    entrance: 'fade' | 'slide' | 'scale' | 'bounce';
}

export interface ResponsiveConfig {
    breakpoints: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
    };
    rules: ResponsiveRule[];
}

export interface ResponsiveRule {
    breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    config: Partial<ChartConfig>;
}

// KPI Card specific types
export interface KPICardData {
    title: string;
    value: number | string;
    unit?: string;
    trend?: {
        direction: 'up' | 'down' | 'stable';
        value: number;
        period: string;
    };
    target?: {
        value: number;
        label: string;
    };
    sparkline?: DataPoint[];
    status: 'success' | 'warning' | 'error' | 'info';
}

// Progress Ring specific types
export interface ProgressRingData {
    title: string;
    value: number;
    max: number;
    unit?: string;
    segments?: Array<{
        value: number;
        color: string;
        label: string;
    }>;
    centerText?: {
        primary: string;
        secondary?: string;
    };
}

// Gauge Chart specific types
export interface GaugeData {
    title: string;
    value: number;
    min: number;
    max: number;
    unit?: string;
    ranges: Array<{
        min: number;
        max: number;
        color: string;
        label: string;
    }>;
    target?: number;
}

// Heatmap specific types
export interface HeatmapData {
    title: string;
    data: Array<{
        x: string | number;
        y: string | number;
        value: number;
        label?: string;
    }>;
    colorScale: {
        min: string;
        max: string;
        steps?: number;
    };
}

// Treemap specific types
export interface TreemapData {
    title: string;
    data: Array<{
        name: string;
        value: number;
        children?: TreemapData['data'];
        color?: string;
    }>;
}

// Chart Loading States
export interface ChartLoadingState {
    isLoading: boolean;
    progress?: number;
    message?: string;
    skeleton: boolean;
}

// Chart Error States
export interface ChartError {
    type: 'data' | 'network' | 'render' | 'config';
    message: string;
    details?: any;
    retryable: boolean;
    timestamp: Date;
}