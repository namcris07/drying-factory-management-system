"use client";

/**
 * contexts/OperatorContext.tsx
 * Context để chia sẻ state giữa OperatorLayout và các operator pages
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Machine, Recipe, initialMachines, recipes } from '@/features/operator/model/machine-data';

export type OperatorContextType = {
  machines:     Machine[];
  setMachines:  React.Dispatch<React.SetStateAction<Machine[]>>;
  zone:         string;
  operatorName: string;
  recipes:      Recipe[];
};

const OperatorContext = createContext<OperatorContextType | null>(null);

export function useOperatorContext() {
  const context = useContext(OperatorContext);
  if (!context) {
    throw new Error('useOperatorContext must be used within OperatorProvider');
  }
  return context;
}

interface OperatorProviderProps {
  children: ReactNode;
  zone: string;
  operatorName: string;
}

export function OperatorProvider({ children, zone, operatorName }: OperatorProviderProps) {
  const [machines, setMachines] = useState<Machine[]>(initialMachines);

  // Real-time simulation (3s)
  useEffect(() => {
    const interval = setInterval(() => {
      setMachines(prev =>
        prev.map(m => {
          if (m.status !== 'Running') return m;
          const newTemp     = Math.max(40, Math.min(95, (m.temp     || 65) + (Math.random() - 0.5) * 1.8));
          const newHum      = Math.max(5,  Math.min(80, (m.humidity || 18) + (Math.random() - 0.5) * 1.2));
          const newProgress = Math.min(100, (m.progress || 0) + 0.06);
          const doorToggle  = Math.random() < 0.04;
          return {
            ...m,
            temp:     Math.round(newTemp * 10) / 10,
            humidity: Math.round(newHum  * 10) / 10,
            progress: Math.round(newProgress * 10) / 10,
            doorOpen: doorToggle ? !m.doorOpen : m.doorOpen,
          };
        }),
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const value: OperatorContextType = {
    machines,
    setMachines,
    zone,
    operatorName,
    recipes,
  };

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  );
}
