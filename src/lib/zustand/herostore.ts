import {create} from 'zustand';
import {Post} from '../providers/types';

export interface Hero {
  heroes: Post[];
  setHeroes: (heroes: Post[]) => void;
}

const useHeroStore = create<Hero>(set => ({
  heroes: [],
  setHeroes: heroes => set({heroes}),
}));

export default useHeroStore;
