import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import axios from 'axios';

export interface SchoolInfo {
  name: string; full_name: string; motto: string; slogan: string; district: string; province: string; country: string;
  address: string; po_box: string; phone: string; email: string; headmaster: string; bursar_name: string; bank_details: string; receipt_footer: string;
}
export interface GradeBand { min: number; grade: string; unit: number; descriptor: string }
export interface LearningArea { name: string; core: boolean }
export interface Weights { project: number; test: number; exam: number }

interface SchoolContextType {
  school: SchoolInfo;
  areas: LearningArea[];
  scale: GradeBand[];
  weights: Weights;
  gradeFor: (mark: number) => GradeBand;
  reload: () => void;
  logoUrl: string;
  logoVersion: number;
}

const FALLBACK: SchoolInfo = {
  name: 'CHAKARI GVT PRI SCHO', full_name: 'CHAKARI GVT PRIMARY SCHOOL', motto: 'Towards the Light', slogan: 'Pilgrim’s Progress',
  district: 'Sanyati District', province: 'Mashonaland West', country: 'Zimbabwe', address: '', po_box: '', phone: '', email: '',
  headmaster: '', bursar_name: '', bank_details: '', receipt_footer: '',
};
const FALLBACK_SCALE: GradeBand[] = [
  { min: 90, grade: 'A', unit: 1, descriptor: 'Outstanding' }, { min: 80, grade: 'A', unit: 2, descriptor: 'Excellent' },
  { min: 70, grade: 'B', unit: 3, descriptor: 'Very good' }, { min: 60, grade: 'C', unit: 4, descriptor: 'Good' },
  { min: 50, grade: 'D', unit: 5, descriptor: 'Satisfactory' }, { min: 40, grade: 'E', unit: 6, descriptor: 'Needs improvement' },
  { min: 30, grade: 'U', unit: 7, descriptor: 'Weak' }, { min: 20, grade: 'U', unit: 8, descriptor: 'Very weak' }, { min: 0, grade: 'U', unit: 9, descriptor: 'Ungraded' },
];

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [school, setSchool] = useState<SchoolInfo>(FALLBACK);
  const [areas, setAreas] = useState<LearningArea[]>([]);
  const [scale, setScale] = useState<GradeBand[]>(FALLBACK_SCALE);
  const [weights, setWeights] = useState<Weights>({ project: 20, test: 20, exam: 60 });
  const [logoVersion, setLogoVersion] = useState(0);

  const load = useCallback(() => {
    axios.get('/api/branding').then((r) => {
      setSchool({ ...FALLBACK, ...r.data.school });
      setAreas(r.data.areas || []);
      setScale(r.data.scale || FALLBACK_SCALE);
      setWeights(r.data.weights || weights);
      setLogoVersion((v) => v + 1);
    }).catch(() => { /* the portal still works with the built-in defaults */ });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = school.name; }, [school.name]);

  const gradeFor = (mark: number): GradeBand => {
    const m = Math.round(mark || 0);
    const sorted = [...scale].sort((a, b) => b.min - a.min);
    return sorted.find((b) => m >= b.min) || sorted[sorted.length - 1];
  };

  return (
    <SchoolContext.Provider value={{ school, areas, scale, weights, gradeFor, reload: load, logoUrl: `/api/branding/logo?v=${logoVersion}`, logoVersion }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider');
  return ctx;
}
