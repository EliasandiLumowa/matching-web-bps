import { create } from 'zustand';

export interface MatchColumnPair {
  col_file1: string;
  col_file2: string;
  type: 'name' | 'text' | 'id';
}

interface MatchingAsnStore {
  matchingResult: any | null;
  fileName1: string;
  fileName2: string;
  file1Headers: string[];
  file2Headers: string[];
  matchColumns: MatchColumnPair[];
  setMatchingResult: (
    result: any,
    name1: string,
    name2: string,
    h1: string[],
    h2: string[],
    cols: MatchColumnPair[]
  ) => void;
  clearResult: () => void;
}

export const useMatchingAsnStore = create<MatchingAsnStore>((set) => ({
  matchingResult: null,
  fileName1: 'File_1.csv',
  fileName2: 'File_2.csv',
  file1Headers: [],
  file2Headers: [],
  matchColumns: [],

  setMatchingResult: (result, name1, name2, h1, h2, cols) =>
    set({
      matchingResult: result,
      fileName1: name1,
      fileName2: name2,
      file1Headers: h1,
      file2Headers: h2,
      matchColumns: cols,
    }),

  clearResult: () =>
    set({
      matchingResult: null,
      fileName1: 'File_1.csv',
      fileName2: 'File_2.csv',
      file1Headers: [],
      file2Headers: [],
      matchColumns: [],
    }),
}));
