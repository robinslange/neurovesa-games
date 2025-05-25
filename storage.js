// Handles saving and loading game results from localStorage

const STORAGE_KEY = 'neurovesa_braingames';

export function loadResults() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
}

export function saveResults(results) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
} 
