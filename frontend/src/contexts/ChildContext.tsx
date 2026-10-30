import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { parentsApi } from '../services/api';

// A parent looks at the school through one child at a time. The chosen child is remembered, and every request the
// portal makes for the pupil pages carries it (see the interceptor in services/api.ts).
export interface Child { id: number; name: string; student_number: string; class_id: number | null; class_name: string | null; balance: number; left: boolean; relationship?: string }

interface ChildState { kids: Child[]; active: Child | null; choose: (id: number) => void; loading: boolean; ready: boolean }
const Ctx = createContext<ChildState>({ kids: [], active: null, choose: () => {}, loading: false, ready: true });
export const useChild = () => useContext(Ctx);

export function ChildProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [kids, setKids] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState<number | null>(Number(localStorage.getItem('activeChild')) || null);
  const [loading, setLoading] = useState(false);
  const [readyFor, setReadyFor] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'parent') { setKids([]); return; }
    if (user.must_change_password) { setKids([]); setReadyFor(user.id); return; }
    setLoading(true);
    parentsApi.children().then((r) => {
      const list: Child[] = r.data;
      setKids(list);
      const keep = list.find((k) => k.id === Number(localStorage.getItem('activeChild')));
      const pick = keep || list[0] || null;
      if (pick) { localStorage.setItem('activeChild', String(pick.id)); setActiveId(pick.id); }
      else { localStorage.removeItem('activeChild'); setActiveId(null); }
    }).catch(() => setKids([])).finally(() => { setLoading(false); setReadyFor(user.id); });
  }, [user?.id, user?.role, user?.must_change_password]);

  const choose = (id: number) => { localStorage.setItem('activeChild', String(id)); setActiveId(id); };
  const active = kids.find((k) => k.id === activeId) || null;
  // false for a parent until their children have been fetched, so no page asks for a child before one is chosen
  const ready = user?.role !== 'parent' || readyFor === user.id || !!user.must_change_password;
  return <Ctx.Provider value={{ kids, active, choose, loading, ready }}>{children}</Ctx.Provider>;
}

// In the header: pick which child you are looking at (just their name when there is only one)
export function ChildSwitcher() {
  const { kids, active, choose } = useChild();
  if (!kids.length) return null;
  if (kids.length === 1) return <span className="hdr-child" title="The child you are looking at">{kids[0].name}</span>;
  return (
    <select className="hdr-select" value={active?.id ?? ''} onChange={(e) => choose(Number(e.target.value))} title="Which child you are looking at" aria-label="Child">
      {kids.map((k) => <option key={k.id} value={k.id}>Child: {k.name}</option>)}
    </select>
  );
}
