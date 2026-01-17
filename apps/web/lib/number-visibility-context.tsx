"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface NumberVisibilityState {
  isVisible: boolean;
  toggleVisibility: () => void;
}

const NumberVisibilityContext = createContext<NumberVisibilityState | undefined>(
  undefined
);

export function NumberVisibilityProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    setIsVisible((prev) => !prev);
  };

  return (
    <NumberVisibilityContext.Provider value={{ isVisible, toggleVisibility }}>
      {children}
    </NumberVisibilityContext.Provider>
  );
}

export function useNumberVisibility() {
  const context = useContext(NumberVisibilityContext);
  if (context === undefined) {
    throw new Error(
      "useNumberVisibility must be used within a NumberVisibilityProvider"
    );
  }
  return context;
}
