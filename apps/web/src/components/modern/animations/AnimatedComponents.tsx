import { motion } from 'framer-motion';
import React, { ReactNode } from 'react';

interface AnimatedProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const FadeIn: React.FC<AnimatedProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const SlideUp: React.FC<AnimatedProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const SlideIn: React.FC<AnimatedProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const ScaleIn: React.FC<AnimatedProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const AnimatedCard: React.FC<AnimatedProps> = ({
  children,
  delay = 0,
  className = '',
}) => (
  <motion.div
    className={`dashboard-card ${className}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      duration: 0.5,
      delay,
      type: 'spring',
      stiffness: 100,
    }}
    whileHover={{
      y: -5,
      boxShadow:
        '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    }}
  >
    {children}
  </motion.div>
);

export const AnimateList: React.FC<{
  children: ReactNode[];
  staggerDelay?: number;
}> = ({ children, staggerDelay = 0.1 }) => (
  <>
    {React.Children.map(children, (child, index) => (
      <SlideUp key={index} delay={index * staggerDelay}>
        {child}
      </SlideUp>
    ))}
  </>
);
