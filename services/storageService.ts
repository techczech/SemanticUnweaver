
import { AppState, SavedVersion } from "../types";
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'stu_versions';

export const getSavedVersions = (): SavedVersion[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveVersion = (state: AppState, name?: string): SavedVersion => {
  const versions = getSavedVersions();
  
  const timestamp = Date.now();
  const dateStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const defaultName = `Step ${state.currentStep} - ${dateStr}`;

  const newVersion: SavedVersion = {
    id: uuidv4(),
    timestamp,
    name: name || defaultName,
    step: state.currentStep,
    state: JSON.parse(JSON.stringify(state)) // Deep copy
  };

  const updatedVersions = [newVersion, ...versions].slice(0, 20); // Keep last 20
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVersions));
  return newVersion;
};

export const deleteVersion = (id: string): SavedVersion[] => {
  const versions = getSavedVersions().filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  return versions;
};

export const clearAllVersions = () => {
  localStorage.removeItem(STORAGE_KEY);
};
