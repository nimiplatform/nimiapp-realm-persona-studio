import { createContext, type ReactNode, useContext } from 'react';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import type { PersonaWorkspaceVisualData } from './persona-workspace-visual-data.js';

type PersonaVisualPreviewData = {
  details: Readonly<Record<string, OwnerPortfolioPersonaDetail>>;
  visualData: Readonly<Record<string, PersonaWorkspaceVisualData>>;
};

const PersonaVisualPreviewContext = createContext<PersonaVisualPreviewData | null>(null);

export function PersonaVisualPreviewProvider({
  details,
  visualData,
  children,
}: PersonaVisualPreviewData & { children: ReactNode }) {
  return (
    <PersonaVisualPreviewContext.Provider value={{ details, visualData }}>
      {children}
    </PersonaVisualPreviewContext.Provider>
  );
}

export function usePersonaVisualPreview(): PersonaVisualPreviewData | null {
  return useContext(PersonaVisualPreviewContext);
}
