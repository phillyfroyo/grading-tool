// Debug detection functions
import { readFileSync } from 'fs';

// Copy the detection functions for testing
function detectTransitionWords(text) {
  const transitionWords = {
    sequence: ['first', 'second', 'third', 'then', 'next', 'after', 'before', 'during', 'while', 'when', 'finally', 'eventually', 'meanwhile', 'simultaneously', 'afterward', 'afterwards', 'later', 'soon', 'previously', 'formerly', 'initially', 'ultimately', 'subsequently', 'first of all', 'secondly'],
    addition: ['also', 'and', 'furthermore', 'moreover', 'in addition', 'additionally', 'besides', 'plus', 'as well as', 'too', 'again', 'another', 'along with', 'likewise', 'similarly'],
    contrast: ['but', 'however', 'although', 'though', 'even though', 'despite', 'in spite of', 'nevertheless', 'nonetheless', 'on the other hand', 'in contrast', 'conversely', 'whereas', 'while', 'yet', 'still', 'otherwise', 'instead'],
    causality: ['because', 'since', 'therefore', 'thus', 'consequently', 'as a result', 'so', 'hence', 'accordingly', 'due to', 'owing to', 'for this reason', 'that is why', 'leads to', 'causes', 'results in'],
    example: ['for example', 'for instance', 'such as', 'including', 'especially', 'particularly', 'notably', 'specifically', 'in fact', 'indeed', 'certainly', 'clearly', 'obviously'],
    conclusion: ['in conclusion', 'to conclude', 'in summary', 'to summarize', 'overall', 'all in all', 'in short', 'briefly', 'to sum up', 'on the whole', 'generally', 'basically'],
    comparison: ['like', 'unlike', 'similar to', 'different from', 'compared to', 'in comparison', 'equally', 'both', 'neither', 'either'],
    frequency: ['always', 'usually', 'often', 'sometimes', 'occasionally', 'rarely', 'never', 'frequently', 'seldom', 'hardly ever', 'once in a while']
  };

  const allTransitions = Object.values(transitionWords).flat();
  const foundTransitions = [];
  
  allTransitions.forEach(transition => {
    const escapedTransition = transition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedTransition}\\b`, 'gi');
    
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      if (!foundTransitions.some(t => t.word === match[0].toLowerCase() && t.position === match.index)) {
        foundTransitions.push({
          word: match[0].toLowerCase(),
          position: match.index,
          category: Object.keys(transitionWords).find(cat => 
            transitionWords[cat].includes(transition.toLowerCase())
          )
        });
      }
    });
  });
  
  foundTransitions.sort((a, b) => a.position - b.position);
  return foundTransitions.map(t => t.word);
}

function detectClassVocabulary(text, classVocabulary) {
  if (!classVocabulary || classVocabulary.length === 0) {
    return [];
  }
  
  const foundVocab = [];
  
  // Separate exact words, prefixes, and suffixes
  const exactWords = [];
  const prefixes = [];
  const suffixes = [];
  
  let currentSection = 'words';
  
  for (const item of classVocabulary) {
    const itemLower = item.toLowerCase().trim();
    
    if (itemLower.includes('prefixes')) {
      currentSection = 'prefixes';
      continue;
    } else if (itemLower.includes('suffixes')) {
      currentSection = 'suffixes';
      continue;
    }
    
    if (currentSection === 'prefixes' && itemLower.endsWith('-')) {
      prefixes.push(itemLower.replace('-', ''));
    } else if (currentSection === 'suffixes' && itemLower.startsWith('-')) {
      suffixes.push(itemLower.replace('-', '').replace(/,.*$/, '').trim());
    } else if (currentSection === 'words') {
      exactWords.push(item);
    }
  }
  
  console.log('Exact words to search for:', exactWords.slice(0, 10)); // First 10 for debugging
  console.log('Prefixes to search for:', prefixes);
  console.log('Suffixes to search for:', suffixes);
  
  // Find exact word matches (case insensitive)
  exactWords.forEach(word => {
    const wordLower = word.toLowerCase();
    const regex = new RegExp(`\\b${wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = [...text.matchAll(regex)];
    
    matches.forEach(match => {
      if (!foundVocab.some(v => v.word.toLowerCase() === match[0].toLowerCase() && v.position === match.index)) {
        foundVocab.push({
          word: match[0],
          position: match.index,
          type: 'exact',
          matchedFrom: word
        });
        console.log(`Found exact match: "${match[0]}" from vocab word "${word}"`);
      }
    });
  });
  
  // Find prefix matches
  prefixes.forEach(prefix => {
    const regex = new RegExp(`\\b${prefix}[a-zA-Z]+\\b`, 'gi');
    const matches = [...text.matchAll(regex)];
    
    matches.forEach(match => {
      const word = match[0];
      if (!foundVocab.some(v => v.word.toLowerCase() === word.toLowerCase() && v.position === match.index)) {
        foundVocab.push({
          word: word,
          position: match.index,
          type: 'prefix',
          matchedFrom: prefix + '-'
        });
        console.log(`Found prefix match: "${word}" from prefix "${prefix}-"`);
      }
    });
  });
  
  // Find suffix matches
  suffixes.forEach(suffix => {
    const suffixVariants = suffix.split(',').map(s => s.trim());
    
    suffixVariants.forEach(variant => {
      if (variant && variant.length > 1) {
        const regex = new RegExp(`\\b[a-zA-Z]+${variant}\\b`, 'gi');
        const matches = [...text.matchAll(regex)];
        
        matches.forEach(match => {
          const word = match[0];
          if (!foundVocab.some(v => v.word.toLowerCase() === word.toLowerCase() && v.position === match.index)) {
            foundVocab.push({
              word: word,
              position: match.index,
              type: 'suffix',
              matchedFrom: '-' + variant
            });
            console.log(`Found suffix match: "${word}" from suffix "-${variant}"`);
          }
        });
      }
    });
  });
  
  foundVocab.sort((a, b) => a.position - b.position);
  return foundVocab.map(v => v.word);
}

// Test cases
const testText = `First of all, I want to say hello. Secondly, I think this is good. But there are problems. However, we can fix them. I am interested in business and revenue. The unfurnished apartment has good accessibility.`;

console.log('=== TESTING TRANSITION DETECTION ===');
console.log('Test text:', testText);
const transitions = detectTransitionWords(testText);
console.log('Found transitions:', transitions);

console.log('\n=== TESTING VOCABULARY DETECTION ===');
// Load class profile
const profilesData = JSON.parse(readFileSync('./class-profiles.json', 'utf8'));
const classProfile = profilesData.profiles.find(p => p.id === 'business_b2_fall2024');

if (classProfile) {
  console.log('Using class profile:', classProfile.name);
  const vocabulary = detectClassVocabulary(testText, classProfile.vocabulary);
  console.log('Found vocabulary:', vocabulary);
} else {
  console.log('Class profile not found');
}