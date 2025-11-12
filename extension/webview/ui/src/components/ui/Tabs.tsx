/**
 * RL4 Cognitive OS - Tabs Component
 * Glassbar navigation with smooth transitions
 * Fixed: Using Context instead of cloneElement to avoid React hook issues
 */

import { useState, createContext, useContext, ReactElement } from 'react';

// Context for tab state
const TabsContext = createContext<{
  active: string;
  setActive: (value: string) => void;
} | null>(null);

interface TabsProps {
  children: ReactElement | ReactElement[];
  defaultValue: string;
}

interface TabProps {
  value: string;
  label: string;
  children: React.ReactNode;
}

export function Tabs({ children, defaultValue }: TabsProps) {
  const [active, setActive] = useState(defaultValue);

  // Ensure children is an array
  const childrenArray = Array.isArray(children) ? children : [children];
  const validChildren = childrenArray.filter(Boolean);

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className="flex flex-col h-full">
        {/* Glassbar Navigation */}
        <nav className="rl4-glassbar">
          {validChildren.map((child, index) => (
            <TabButton
              key={child.props.value || `tab-${index}`}
              value={child.props.value}
              label={child.props.label}
            />
          ))}
        </nav>

        {/* Tab Content */}
        <main className="rl4-main rl4-fade-in">
          {validChildren.map((child) => (
            <Tab
              key={child.props.value}
              value={child.props.value}
              label={child.props.label}
            >
              {child.props.children}
            </Tab>
          ))}
        </main>
      </div>
    </TabsContext.Provider>
  );
}

// Internal component for tab buttons
function TabButton({ value, label }: { value: string; label: string }) {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error('TabButton must be used within Tabs');
  }

  const { active, setActive } = context;
  const isActive = active === value;
  
  return (
    <button 
      onClick={() => setActive(value)} 
      className={`rl4-tab ${isActive ? 'rl4-tab--active' : ''}`}
    >
      {label}
    </button>
  );
}

// Tab component (container for tab content)
export function Tab({ value, label, children }: TabProps) {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error('Tab must be used within Tabs');
  }

  const { active } = context;
  const isActive = active === value;

  if (!isActive) return null;

  return <>{children}</>;
}
